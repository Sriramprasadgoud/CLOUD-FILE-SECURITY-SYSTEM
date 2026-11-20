import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config();

interface DevSecrets {
  secretKey: string;
  encryptionKeyHex: string;
}

function loadOrCreateDevSecrets(): DevSecrets {
  const secretFile = path.resolve(process.cwd(), '.dev_secret');
  if (fs.existsSync(secretFile)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(secretFile, 'utf8')) as Partial<DevSecrets>;
      if (parsed.secretKey && parsed.encryptionKeyHex && parsed.encryptionKeyHex.length === 64) {
        return {
          secretKey: parsed.secretKey,
          encryptionKeyHex: parsed.encryptionKeyHex,
        };
      }
    } catch {
      // Regenerate below if corrupted
    }
  }
  const generated: DevSecrets = {
    secretKey: crypto.randomBytes(32).toString('hex'),
    encryptionKeyHex: crypto.randomBytes(32).toString('hex'),
  };
  fs.writeFileSync(secretFile, JSON.stringify(generated), { mode: 0o600 });
  return generated;
}

function resolveEncryptionKey(): Buffer {
  const envKey = process.env.ENCRYPTION_KEY?.trim();
  if (envKey && !envKey.startsWith('CHANGE_ME')) {
    if (/^[0-9a-fA-F]{64}$/.test(envKey)) {
      return Buffer.from(envKey, 'hex');
    }
    const b64 = Buffer.from(envKey, 'base64');
    if (b64.length === 32) {
      return b64;
    }
    return crypto.createHash('sha256').update(envKey, 'utf8').digest();
  }
  return Buffer.from(loadOrCreateDevSecrets().encryptionKeyHex, 'hex');
}

function resolveSecretKey(): string {
  const envSecret = process.env.SECRET_KEY?.trim();
  if (envSecret && !envSecret.startsWith('CHANGE_ME')) {
    return envSecret;
  }
  return loadOrCreateDevSecrets().secretKey;
}

const awsKey = process.env.AWS_ACCESS_KEY_ID?.trim() || '';
const awsSecret = process.env.AWS_SECRET_ACCESS_KEY?.trim() || '';
const awsBucket = process.env.AWS_S3_BUCKET?.trim() || '';
const awsRegion = process.env.AWS_REGION?.trim() || 'us-east-1';

export const ALLOWED_EXTENSIONS = new Set([
  'pdf', 'txt', 'md', 'csv', 'json', 'xml', 'yaml', 'yml', 'log',
  'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg',
  'zip', 'tar', 'gz',
  'py', 'js', 'ts', 'html', 'css', 'sql',
]);

export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

export const config = {
  port: Number(process.env.PORT || 3000),
  secretKey: resolveSecretKey(),
  encryptionKey: resolveEncryptionKey(),
  databasePath: path.resolve(process.cwd(), process.env.DATABASE_PATH || './data/cloud_vault.db'),
  localStorageDir: path.resolve(process.cwd(), process.env.LOCAL_STORAGE_DIR || './storage/encrypted'),
  aws: {
    enabled: Boolean(awsKey && awsSecret && awsBucket),
    accessKeyId: awsKey,
    secretAccessKey: awsSecret,
    region: awsRegion,
    bucket: awsBucket,
  },
};
