import crypto from 'node:crypto';
import path from 'node:path';
import cookieParser from 'cookie-parser';
import express from 'express';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import {
  binarySearchFiles,
  linearSearchFiles,
  mergeSortFiles,
  quickSortFiles,
  type SearchField,
  type SortAlgorithm,
  type SortField,
  type SortOrder,
} from './server/algorithms';
import {
  type AuthenticatedRequest,
  clearSessionCookie,
  issueCsrfToken,
  issueSessionCookie,
  requireAuth,
  sanitizeFilename,
  validateFileExtension,
  verifyCsrf,
} from './server/auth';
import { ALLOWED_EXTENSIONS, MAX_FILE_SIZE_BYTES, config } from './server/config';
import {
  computeSha256,
  decryptAes256Gcm,
  encryptAes256Gcm,
  hashPassword,
  verifyPassword,
} from './server/crypto';
import { db, type FileRow, logActivity, type UserRow } from './server/db';
import {
  buildUserStorageKey,
  deleteEncryptedObject,
  downloadEncryptedObject,
  getStorageMode,
  listUserObjects,
  uploadEncryptedObject,
} from './server/storage';

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());
app.use('/api', verifyCsrf);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
  },
});

// --- Auth & CSRF Routes ---

app.get('/api/auth/csrf', (req, res) => {
  const csrfToken = issueCsrfToken(req, res);
  res.json({ csrfToken });
});

app.post('/api/auth/register', (req, res) => {
  const username = String(req.body?.username ?? '').trim();
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');

  if (username.length < 3 || username.length > 32 || !/^[a-zA-Z0-9_.\- ]+$/.test(username)) {
    res.status(400).json({
      error: 'Username must be 3-32 characters (letters, numbers, spaces, ., _, -).',
    });
    return;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: 'Please provide a valid email address.' });
    return;
  }

  if (password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters long.' });
    return;
  }

  const existing = db
    .prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?) OR email = ?')
    .get(username, email) as { id: number } | undefined;

  if (existing) {
    res.status(409).json({ error: 'An account with that username or email already exists.' });
    return;
  }

  const passwordHash = hashPassword(password);
  const result = db
    .prepare('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)')
    .run(username, email, passwordHash);

  const userId = Number(result.lastInsertRowid);
  logActivity(userId, 'USER_REGISTER', null, 'SUCCESS');
  const sessionToken = issueSessionCookie(req, res, userId);

  const user = db
    .prepare('SELECT id, username, email, created_at FROM users WHERE id = ?')
    .get(userId);
  res.status(201).json({ user, sessionToken });
});

app.post('/api/auth/login', (req, res) => {
  const identifier = String(req.body?.identifier ?? '').trim();
  const password = String(req.body?.password ?? '');

  if (!identifier || !password) {
    res.status(400).json({ error: 'Username/email and password are required.' });
    return;
  }

  const user = db
    .prepare('SELECT * FROM users WHERE LOWER(username) = LOWER(?) OR email = ?')
    .get(identifier, identifier.toLowerCase()) as UserRow | undefined;

  if (!user || !verifyPassword(password, user.password_hash)) {
    if (user) {
      logActivity(user.id, 'USER_LOGIN', null, 'FAILED');
    }
    res.status(401).json({ error: 'Invalid username/email or password.' });
    return;
  }

  logActivity(user.id, 'USER_LOGIN', null, 'SUCCESS');
  const sessionToken = issueSessionCookie(req, res, user.id);

  res.json({
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      created_at: user.created_at,
    },
    sessionToken,
  });
});

app.post('/api/auth/logout', requireAuth, (req: AuthenticatedRequest, res) => {
  if (req.user) {
    logActivity(req.user.id, 'USER_LOGOUT', null, 'SUCCESS');
  }
  clearSessionCookie(req, res);
  res.json({ ok: true });
});

app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
  res.json({ user: req.user });
});

// --- Profile & Security Info ---

app.post('/api/profile/password', requireAuth, (req: AuthenticatedRequest, res) => {
  const currentPassword = String(req.body?.currentPassword ?? '');
  const newPassword = String(req.body?.newPassword ?? '');

  if (newPassword.length < 8) {
    res.status(400).json({ error: 'New password must be at least 8 characters long.' });
    return;
  }

  const user = db
    .prepare('SELECT * FROM users WHERE id = ?')
    .get(req.user!.id) as UserRow | undefined;

  if (!user || !verifyPassword(currentPassword, user.password_hash)) {
    logActivity(req.user!.id, 'PASSWORD_UPDATE', null, 'FAILED');
    res.status(401).json({ error: 'Current password is incorrect.' });
    return;
  }

  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(
    hashPassword(newPassword),
    user.id,
  );
  logActivity(user.id, 'PASSWORD_UPDATE', null, 'SUCCESS');
  res.json({ ok: true });
});

app.get('/api/profile/security-summary', requireAuth, async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const vaultKeys = await listUserObjects(userId);
  res.json({
    storageMode: getStorageMode(),
    s3Configured: config.aws.enabled,
    s3Region: config.aws.enabled ? config.aws.region : 'N/A (Local Encrypted Vault)',
    s3Bucket: config.aws.enabled ? config.aws.bucket : 'local-encrypted-vault',
    cipherSuite: 'AES-256-GCM (12-byte random nonce + 128-bit auth tag)',
    hashAlgorithm: 'SHA-256',
    passwordKdf: 'scrypt (per-user 16-byte random salt)',
    maxFileSizeMb: MAX_FILE_SIZE_BYTES / (1024 * 1024),
    allowedExtensions: Array.from(ALLOWED_EXTENSIONS),
    storedObjectsCount: vaultKeys.length,
  });
});

// --- Dashboard Summary ---

app.get('/api/dashboard', requireAuth, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const stats = db
    .prepare(
      `SELECT
        COUNT(*) as totalFiles,
        COALESCE(SUM(file_size), 0) as totalStorageBytes
      FROM files
      WHERE user_id = ?`,
    )
    .get(userId) as { totalFiles: number; totalStorageBytes: number };

  const integrityStats = db
    .prepare(
      `SELECT COUNT(*) as verifiedChecks
      FROM activity_logs
      WHERE user_id = ? AND action = 'INTEGRITY_VERIFICATION' AND status = 'SUCCESS'`,
    )
    .get(userId) as { verifiedChecks: number };

  const recentFiles = db
    .prepare(
      `SELECT id, original_filename, file_size, file_type, sha256_hash, storage_provider, last_verified_status, last_verified_at, upload_date
      FROM files
      WHERE user_id = ?
      ORDER BY upload_date DESC
      LIMIT 6`,
    )
    .all(userId);

  const recentLogs = db
    .prepare(
      `SELECT id, action, filename, timestamp, status
      FROM activity_logs
      WHERE user_id = ?
      ORDER BY id DESC
      LIMIT 8`,
    )
    .all(userId);

  res.json({
    stats: {
      totalFiles: stats.totalFiles,
      totalStorageBytes: stats.totalStorageBytes,
      encryptedFiles: stats.totalFiles,
      successfulIntegrityChecks: integrityStats.verifiedChecks,
      storageMode: getStorageMode(),
    },
    recentFiles,
    recentLogs,
  });
});

// --- File Upload, List, Download, Verify, Delete ---

app.get('/api/files', requireAuth, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const files = db
    .prepare(
      `SELECT id, user_id, original_filename, encrypted_storage_key, file_size, file_type, sha256_hash, encryption_nonce, storage_provider, last_verified_status, last_verified_at, upload_date
      FROM files
      WHERE user_id = ?
      ORDER BY upload_date DESC`,
    )
    .all(userId);

  res.json({ files, storageMode: getStorageMode() });
});

app.post('/api/files/upload', requireAuth, (req: AuthenticatedRequest, res) => {
  upload.single('file')(req, res, async (multerErr) => {
    if (multerErr) {
      if (multerErr.code === 'LIMIT_FILE_SIZE') {
        res.status(413).json({
          error: `File exceeds maximum allowed size of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB.`,
        });
        return;
      }
      res.status(400).json({ error: multerErr.message });
      return;
    }

    const uploaded = req.file;
    if (!uploaded) {
      res.status(400).json({ error: 'No file provided for upload.' });
      return;
    }

    const userId = req.user!.id;
    const safeName = sanitizeFilename(uploaded.originalname);
    const { valid, ext } = validateFileExtension(safeName);

    if (!valid) {
      logActivity(userId, 'FILE_UPLOAD', safeName, 'FAILED');
      res.status(400).json({
        error: `File extension ".${ext || 'unknown'}" is not allowed by security policy.`,
      });
      return;
    }

    try {
      // 1. Compute SHA-256 hash of plaintext BEFORE encryption
      const sha256Hash = computeSha256(uploaded.buffer);

      // 2. Encrypt plaintext with AES-256-GCM + unique 12-byte random nonce
      const { ciphertext, nonceHex, authTagHex } = encryptAes256Gcm(uploaded.buffer);
      logActivity(userId, 'FILE_ENCRYPTION', safeName, 'SUCCESS');

      // 3. Upload ONLY ciphertext to AWS S3 (or local encrypted vault fallback)
      const uniqueId = crypto.randomUUID();
      const storageKey = buildUserStorageKey(userId, uniqueId);
      const provider = await uploadEncryptedObject(storageKey, ciphertext);
      logActivity(userId, 'CLOUD_UPLOAD', safeName, 'SUCCESS');

      // 4. Persist metadata in SQLite
      const fileType = uploaded.mimetype || `application/${ext}`;
      const insert = db
        .prepare(
          `INSERT INTO files (
            user_id, original_filename, encrypted_storage_key, file_size, file_type,
            sha256_hash, encryption_nonce, auth_tag, storage_provider, last_verified_status, last_verified_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'verified', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`,
        )
        .run(
          userId,
          safeName,
          storageKey,
          uploaded.size,
          fileType,
          sha256Hash,
          nonceHex,
          authTagHex,
          provider,
        );

      logActivity(userId, 'FILE_UPLOAD', safeName, 'SUCCESS');

      const record = db
        .prepare(
          `SELECT id, user_id, original_filename, encrypted_storage_key, file_size, file_type, sha256_hash, encryption_nonce, storage_provider, last_verified_status, last_verified_at, upload_date
          FROM files WHERE id = ?`,
        )
        .get(Number(insert.lastInsertRowid));

      res.status(201).json({
        file: record,
        encryption: {
          algorithm: 'AES-256-GCM',
          nonceHex,
          sha256Hash,
          storageProvider: provider,
        },
      });
    } catch (err) {
      logActivity(userId, 'FILE_UPLOAD', safeName, 'FAILED');
      const message = err instanceof Error ? err.message : 'Encrypted upload failed.';
      res.status(500).json({ error: message });
    }
  });
});

app.get('/api/files/:id/download', requireAuth, async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const fileId = Number(req.params.id);

  if (!Number.isInteger(fileId) || fileId <= 0) {
    res.status(400).json({ error: 'Invalid file ID.' });
    return;
  }

  const file = db
    .prepare('SELECT * FROM files WHERE id = ? AND user_id = ?')
    .get(fileId, userId) as FileRow | undefined;

  if (!file) {
    res.status(404).json({ error: 'File not found or access denied.' });
    return;
  }

  try {
    const encryptedBytes = await downloadEncryptedObject(
      file.encrypted_storage_key,
      file.storage_provider,
    );
    const decrypted = decryptAes256Gcm(
      encryptedBytes,
      file.encryption_nonce,
      file.auth_tag,
    );
    logActivity(userId, 'FILE_DECRYPTION', file.original_filename, 'SUCCESS');

    const computedHash = computeSha256(decrypted);
    const authentic = computedHash === file.sha256_hash;

    db.prepare(
      `UPDATE files
       SET last_verified_status = ?, last_verified_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id = ? AND user_id = ?`,
    ).run(authentic ? 'verified' : 'modified', file.id, userId);

    logActivity(
      userId,
      'INTEGRITY_VERIFICATION',
      file.original_filename,
      authentic ? 'SUCCESS' : 'WARNING',
    );
    logActivity(userId, 'FILE_DOWNLOAD', file.original_filename, 'SUCCESS');

    res.setHeader('Content-Type', file.file_type || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.original_filename.replace(/"/g, '')}"`,
    );
    res.setHeader('X-Original-SHA256', file.sha256_hash);
    res.setHeader('X-Computed-SHA256', computedHash);
    res.setHeader('X-Integrity-Status', authentic ? 'AUTHENTIC' : 'MODIFIED');
    res.setHeader('Access-Control-Expose-Headers', 'X-Original-SHA256, X-Computed-SHA256, X-Integrity-Status');
    res.send(decrypted);
  } catch (err) {
    logActivity(userId, 'FILE_DOWNLOAD', file.original_filename, 'FAILED');
    const message =
      err instanceof Error ? err.message : 'Decryption or download verification failed.';
    res.status(500).json({ error: message });
  }
});

app.post('/api/files/:id/verify', requireAuth, async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const fileId = Number(req.params.id);

  if (!Number.isInteger(fileId) || fileId <= 0) {
    res.status(400).json({ error: 'Invalid file ID.' });
    return;
  }

  const file = db
    .prepare('SELECT * FROM files WHERE id = ? AND user_id = ?')
    .get(fileId, userId) as FileRow | undefined;

  if (!file) {
    res.status(404).json({ error: 'File not found or access denied.' });
    return;
  }

  try {
    const encryptedBytes = await downloadEncryptedObject(
      file.encrypted_storage_key,
      file.storage_provider,
    );
    const decrypted = decryptAes256Gcm(
      encryptedBytes,
      file.encryption_nonce,
      file.auth_tag,
    );
    const computedHash = computeSha256(decrypted);
    const authentic = computedHash === file.sha256_hash;
    const checkedAt = new Date().toISOString();

    db.prepare(
      `UPDATE files
       SET last_verified_status = ?, last_verified_at = ?
       WHERE id = ? AND user_id = ?`,
    ).run(authentic ? 'verified' : 'modified', checkedAt, file.id, userId);

    logActivity(
      userId,
      'INTEGRITY_VERIFICATION',
      file.original_filename,
      authentic ? 'SUCCESS' : 'WARNING',
    );

    res.json({
      fileId: file.id,
      filename: file.original_filename,
      originalHash: file.sha256_hash,
      computedHash,
      authentic,
      statusLabel: authentic ? 'Authentic (Hash Match)' : 'Modified (Hash Mismatch)',
      checkedAt,
      cipher: 'AES-256-GCM',
      hashAlgorithm: 'SHA-256',
      storageProvider: file.storage_provider,
    });
  } catch (err) {
    db.prepare(
      `UPDATE files SET last_verified_status = 'modified', last_verified_at = ? WHERE id = ? AND user_id = ?`,
    ).run(new Date().toISOString(), file.id, userId);

    logActivity(userId, 'INTEGRITY_VERIFICATION', file.original_filename, 'FAILED');
    res.status(200).json({
      fileId: file.id,
      filename: file.original_filename,
      originalHash: file.sha256_hash,
      computedHash: 'DECRYPTION_AUTHENTICATION_FAILED',
      authentic: false,
      statusLabel: 'Tampered or Corrupted Ciphertext (GCM Auth Failed)',
      checkedAt: new Date().toISOString(),
      cipher: 'AES-256-GCM',
      hashAlgorithm: 'SHA-256',
      storageProvider: file.storage_provider,
      errorDetail: err instanceof Error ? err.message : 'Ciphertext authentication failed.',
    });
  }
});

app.delete('/api/files/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const fileId = Number(req.params.id);

  if (!Number.isInteger(fileId) || fileId <= 0) {
    res.status(400).json({ error: 'Invalid file ID.' });
    return;
  }

  const file = db
    .prepare('SELECT * FROM files WHERE id = ? AND user_id = ?')
    .get(fileId, userId) as FileRow | undefined;

  if (!file) {
    res.status(404).json({ error: 'File not found or access denied.' });
    return;
  }

  try {
    await deleteEncryptedObject(file.encrypted_storage_key, file.storage_provider);
    db.prepare('DELETE FROM files WHERE id = ? AND user_id = ?').run(file.id, userId);
    logActivity(userId, 'FILE_DELETE', file.original_filename, 'SUCCESS');
    res.json({ ok: true, deletedId: file.id });
  } catch (err) {
    logActivity(userId, 'FILE_DELETE', file.original_filename, 'FAILED');
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to delete file.',
    });
  }
});

// --- Algorithms Routes ---

app.get('/api/algorithms/search', requireAuth, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const algorithm = String(req.query.algorithm ?? 'linear').toLowerCase();
  const query = String(req.query.q ?? '');
  const field = String(req.query.field ?? 'filename') as SearchField;

  const files = db
    .prepare(
      `SELECT id, user_id, original_filename, encrypted_storage_key, file_size, file_type, sha256_hash, encryption_nonce, auth_tag, storage_provider, last_verified_status, last_verified_at, upload_date
      FROM files
      WHERE user_id = ?`,
    )
    .all(userId) as FileRow[];

  if (algorithm === 'binary') {
    const out = binarySearchFiles(files, query);
    res.json(out);
    return;
  }

  const validField: SearchField =
    field === 'extension' || field === 'file_type' ? field : 'filename';
  const out = linearSearchFiles(files, query, validField);
  res.json(out);
});

app.get('/api/algorithms/sort', requireAuth, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const algorithm = String(req.query.algorithm ?? 'merge').toLowerCase() as SortAlgorithm;
  const sortByRaw = String(req.query.sortBy ?? 'filename');
  const order: SortOrder = String(req.query.order ?? 'asc').toLowerCase() === 'desc' ? 'desc' : 'asc';

  const files = db
    .prepare(
      `SELECT id, user_id, original_filename, encrypted_storage_key, file_size, file_type, sha256_hash, encryption_nonce, auth_tag, storage_provider, last_verified_status, last_verified_at, upload_date
      FROM files
      WHERE user_id = ?`,
    )
    .all(userId) as FileRow[];

  if (algorithm === 'quick') {
    const quickField = sortByRaw === 'filename' ? 'filename' : 'file_size';
    res.json(quickSortFiles(files, quickField, order));
    return;
  }

  const mergeField: SortField =
    sortByRaw === 'upload_date' || sortByRaw === 'file_size' ? sortByRaw : 'filename';
  res.json(mergeSortFiles(files, mergeField, order));
});

// --- Activity Logs Route ---

app.get('/api/logs', requireAuth, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const actionFilter = String(req.query.action ?? '').trim();

  const logs = actionFilter
    ? db
        .prepare(
          `SELECT id, action, filename, timestamp, status
           FROM activity_logs
           WHERE user_id = ? AND action = ?
           ORDER BY id DESC
           LIMIT 200`,
        )
        .all(userId, actionFilter)
    : db
        .prepare(
          `SELECT id, action, filename, timestamp, status
           FROM activity_logs
           WHERE user_id = ?
           ORDER BY id DESC
           LIMIT 200`,
        )
        .all(userId);

  res.json({ logs });
});

async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(config.port, '0.0.0.0', () => {
    console.log(`Cloud File Security System listening on http://0.0.0.0:${config.port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
