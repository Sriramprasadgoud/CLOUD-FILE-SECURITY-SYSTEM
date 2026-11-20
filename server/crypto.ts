import crypto from 'node:crypto';
import { config } from './config';

const SCRYPT_KEYLEN = 64;
const GCM_NONCE_BYTES = 12;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') {
    return false;
  }
  const [, salt, expectedHex] = parts;
  const derived = crypto.scryptSync(password, salt, SCRYPT_KEYLEN);
  const expected = Buffer.from(expectedHex, 'hex');
  if (derived.length !== expected.length) {
    return false;
  }
  return crypto.timingSafeEqual(derived, expected);
}

export function computeSha256(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export interface EncryptionResult {
  ciphertext: Buffer;
  nonceHex: string;
  authTagHex: string;
}

export function encryptAes256Gcm(
  plaintext: Buffer,
  key: Buffer = config.encryptionKey,
): EncryptionResult {
  if (key.length !== 32) {
    throw new Error('AES-256-GCM requires a 32-byte encryption key.');
  }
  const nonce = crypto.randomBytes(GCM_NONCE_BYTES);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    ciphertext: encrypted,
    nonceHex: nonce.toString('hex'),
    authTagHex: authTag.toString('hex'),
  };
}

export function decryptAes256Gcm(
  ciphertext: Buffer,
  nonceHex: string,
  authTagHex: string,
  key: Buffer = config.encryptionKey,
): Buffer {
  if (key.length !== 32) {
    throw new Error('AES-256-GCM requires a 32-byte encryption key.');
  }
  const nonce = Buffer.from(nonceHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonce);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}
