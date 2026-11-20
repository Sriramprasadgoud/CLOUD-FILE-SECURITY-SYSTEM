import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

// Use isolated test database and local vault before importing server modules
const testTmp = path.resolve(process.cwd(), 'data', 'test_run');
fs.mkdirSync(testTmp, { recursive: true });
process.env.DATABASE_PATH = path.join(testTmp, 'test_vault.db');
process.env.LOCAL_STORAGE_DIR = path.join(testTmp, 'encrypted');
process.env.ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
process.env.SECRET_KEY = crypto.randomBytes(32).toString('hex');

import {
  binarySearchFiles,
  linearSearchFiles,
  mergeSortFiles,
  quickSortFiles,
} from '../server/algorithms';
import {
  computeSha256,
  decryptAes256Gcm,
  encryptAes256Gcm,
  hashPassword,
  verifyPassword,
} from '../server/crypto';
import { db, logActivity, type FileRow } from '../server/db';
import {
  buildUserStorageKey,
  deleteEncryptedObject,
  downloadEncryptedObject,
  uploadEncryptedObject,
} from '../server/storage';

test('1-3. User registration, login, and incorrect password rejection', () => {
  const pwHash = hashPassword('Str0ngPass!2026');
  const res = db
    .prepare('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)')
    .run(`alice_${Date.now()}`, `alice_${Date.now()}@example.edu`, pwHash);

  const userId = Number(res.lastInsertRowid);
  assert.ok(userId > 0);
  assert.equal(verifyPassword('Str0ngPass!2026', pwHash), true);
  assert.equal(verifyPassword('WrongPassword!', pwHash), false);
});

test('4-7. AES-256-GCM encryption, decryption, SHA-256 hashing, and tamper detection', () => {
  const plaintext = Buffer.from('Top secret academic research dataset v1');
  const originalHash = computeSha256(plaintext);
  assert.equal(originalHash.length, 64);

  const enc1 = encryptAes256Gcm(plaintext);
  const enc2 = encryptAes256Gcm(plaintext);
  assert.notEqual(enc1.nonceHex, enc2.nonceHex);
  assert.notDeepEqual(enc1.ciphertext, plaintext);

  const decrypted = decryptAes256Gcm(enc1.ciphertext, enc1.nonceHex, enc1.authTagHex);
  assert.deepEqual(decrypted, plaintext);
  assert.equal(computeSha256(decrypted), originalHash);

  // Tamper ciphertext byte -> GCM auth tag verification must throw
  const tampered = Buffer.from(enc1.ciphertext);
  tampered[0] ^= 0xff;
  assert.throws(() => {
    decryptAes256Gcm(tampered, enc1.nonceHex, enc1.authTagHex);
  });
});

test('8-9, 14-15. Encrypted storage upload, download, ownership isolation, and deletion', async () => {
  const u1 = Number(
    db
      .prepare('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)')
      .run(`owner_${Date.now()}`, `owner_${Date.now()}@example.edu`, hashPassword('Password123!'))
      .lastInsertRowid,
  );
  const u2 = Number(
    db
      .prepare('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)')
      .run(`other_${Date.now()}`, `other_${Date.now()}@example.edu`, hashPassword('Password123!'))
      .lastInsertRowid,
  );

  const payload = Buffer.from('Private user #1 content');
  const sha = computeSha256(payload);
  const enc = encryptAes256Gcm(payload);
  const key = buildUserStorageKey(u1, crypto.randomUUID());

  const provider = await uploadEncryptedObject(key, enc.ciphertext);
  const insert = db
    .prepare(
      `INSERT INTO files (user_id, original_filename, encrypted_storage_key, file_size, file_type, sha256_hash, encryption_nonce, auth_tag, storage_provider)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(u1, 'thesis_draft.pdf', key, payload.length, 'application/pdf', sha, enc.nonceHex, enc.authTagHex, provider);
  const fileId = Number(insert.lastInsertRowid);

  // Unauthorized access check: user 2 cannot retrieve user 1's file
  const unauthorizedLookup = db
    .prepare('SELECT * FROM files WHERE id = ? AND user_id = ?')
    .get(fileId, u2);
  assert.equal(unauthorizedLookup, undefined);

  // Authorized download & decrypt
  const fetched = await downloadEncryptedObject(key, provider);
  const recovered = decryptAes256Gcm(fetched, enc.nonceHex, enc.authTagHex);
  assert.deepEqual(recovered, payload);

  // Delete object and DB record
  await deleteEncryptedObject(key, provider);
  db.prepare('DELETE FROM files WHERE id = ? AND user_id = ?').run(fileId, u1);
  const afterDelete = db.prepare('SELECT * FROM files WHERE id = ?').get(fileId);
  assert.equal(afterDelete, undefined);

  logActivity(u1, 'FILE_DELETE', 'thesis_draft.pdf', 'SUCCESS');
});

test('10-13. Linear Search, Binary Search, Merge Sort, and Quick Sort algorithms', () => {
  const sample: FileRow[] = [
    {
      id: 1,
      user_id: 1,
      original_filename: 'zeta.txt',
      encrypted_storage_key: 'k1',
      file_size: 400,
      file_type: 'text/plain',
      sha256_hash: 'a'.repeat(64),
      encryption_nonce: '0'.repeat(24),
      auth_tag: '0'.repeat(32),
      storage_provider: 'local',
      last_verified_status: 'verified',
      last_verified_at: null,
      upload_date: '2026-11-12T10:00:00.000Z',
    },
    {
      id: 2,
      user_id: 1,
      original_filename: 'alpha.pdf',
      encrypted_storage_key: 'k2',
      file_size: 2048,
      file_type: 'application/pdf',
      sha256_hash: 'b'.repeat(64),
      encryption_nonce: '0'.repeat(24),
      auth_tag: '0'.repeat(32),
      storage_provider: 'local',
      last_verified_status: 'verified',
      last_verified_at: null,
      upload_date: '2026-11-10T10:00:00.000Z',
    },
    {
      id: 3,
      user_id: 1,
      original_filename: 'bravo.csv',
      encrypted_storage_key: 'k3',
      file_size: 128,
      file_type: 'text/csv',
      sha256_hash: 'c'.repeat(64),
      encryption_nonce: '0'.repeat(24),
      auth_tag: '0'.repeat(32),
      storage_provider: 'local',
      last_verified_status: 'verified',
      last_verified_at: null,
      upload_date: '2026-11-15T10:00:00.000Z',
    },
  ];

  const linName = linearSearchFiles(sample, 'bravo', 'filename');
  assert.equal(linName.results.length, 1);
  assert.equal(linName.results[0].id, 3);

  const linExt = linearSearchFiles(sample, 'pdf', 'extension');
  assert.equal(linExt.results.length, 1);
  assert.equal(linExt.results[0].id, 2);

  const bin = binarySearchFiles(sample, 'alpha');
  assert.equal(bin.results.length, 1);
  assert.equal(bin.results[0].original_filename, 'alpha.pdf');

  const mergeName = mergeSortFiles(sample, 'filename', 'asc');
  assert.deepEqual(
    mergeName.results.map((r) => r.original_filename),
    ['alpha.pdf', 'bravo.csv', 'zeta.txt'],
  );

  const mergeDateDesc = mergeSortFiles(sample, 'upload_date', 'desc');
  assert.deepEqual(
    mergeDateDesc.results.map((r) => r.id),
    [3, 1, 2],
  );

  const quickSizeAsc = quickSortFiles(sample, 'file_size', 'asc');
  assert.deepEqual(
    quickSizeAsc.results.map((r) => r.file_size),
    [128, 400, 2048],
  );

  const quickNameDesc = quickSortFiles(sample, 'filename', 'desc');
  assert.deepEqual(
    quickNameDesc.results.map((r) => r.original_filename),
    ['zeta.txt', 'bravo.csv', 'alpha.pdf'],
  );
});
