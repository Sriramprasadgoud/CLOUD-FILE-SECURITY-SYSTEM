import fs from 'node:fs';
import path from 'node:path';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { config } from './config';

let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: config.aws.region,
      credentials: {
        accessKeyId: config.aws.accessKeyId,
        secretAccessKey: config.aws.secretAccessKey,
      },
    });
  }
  return s3Client;
}

fs.mkdirSync(config.localStorageDir, { recursive: true });

export function getStorageMode(): 's3' | 'local' {
  return config.aws.enabled ? 's3' : 'local';
}

export function buildUserStorageKey(userId: number, uniqueId: string): string {
  return `users/${userId}/vault/${uniqueId}.enc`;
}

function resolveLocalPath(storageKey: string): string {
  const safeRelative = storageKey.replace(/^\/+/, '');
  const resolved = path.resolve(config.localStorageDir, safeRelative);
  if (!resolved.startsWith(config.localStorageDir)) {
    throw new Error('Invalid storage path traversal attempt.');
  }
  return resolved;
}

export async function uploadEncryptedObject(
  storageKey: string,
  encryptedBytes: Buffer,
  providerOverride?: 's3' | 'local',
): Promise<'s3' | 'local'> {
  const provider = providerOverride ?? getStorageMode();
  if (provider === 's3') {
    const client = getS3Client();
    await client.send(
      new PutObjectCommand({
        Bucket: config.aws.bucket,
        Key: storageKey,
        Body: encryptedBytes,
        ContentType: 'application/octet-stream',
        ServerSideEncryption: 'AES256',
      }),
    );
    return 's3';
  }

  const targetPath = resolveLocalPath(storageKey);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, encryptedBytes, { mode: 0o600 });
  return 'local';
}

export async function downloadEncryptedObject(
  storageKey: string,
  provider: 's3' | 'local',
): Promise<Buffer> {
  if (provider === 's3') {
    const client = getS3Client();
    const response = await client.send(
      new GetObjectCommand({
        Bucket: config.aws.bucket,
        Key: storageKey,
      }),
    );
    if (!response.Body) {
      throw new Error('Empty response body from S3 object.');
    }
    const byteArray = await response.Body.transformToByteArray();
    return Buffer.from(byteArray);
  }

  const targetPath = resolveLocalPath(storageKey);
  if (!fs.existsSync(targetPath)) {
    throw new Error('Encrypted file blob not found in local vault.');
  }
  return fs.readFileSync(targetPath);
}

export async function deleteEncryptedObject(
  storageKey: string,
  provider: 's3' | 'local',
): Promise<void> {
  if (provider === 's3') {
    const client = getS3Client();
    await client.send(
      new DeleteObjectCommand({
        Bucket: config.aws.bucket,
        Key: storageKey,
      }),
    );
    return;
  }

  const targetPath = resolveLocalPath(storageKey);
  if (fs.existsSync(targetPath)) {
    fs.unlinkSync(targetPath);
  }
}

export async function listUserObjects(userId: number): Promise<string[]> {
  const prefix = `users/${userId}/vault/`;
  if (getStorageMode() === 's3') {
    const client = getS3Client();
    const res = await client.send(
      new ListObjectsV2Command({
        Bucket: config.aws.bucket,
        Prefix: prefix,
      }),
    );
    return (res.Contents ?? []).map((item) => item.Key || '').filter(Boolean);
  }

  const userDir = resolveLocalPath(prefix);
  if (!fs.existsSync(userDir)) {
    return [];
  }
  return fs
    .readdirSync(userDir)
    .filter((f) => f.endsWith('.enc'))
    .map((f) => `${prefix}${f}`);
}
