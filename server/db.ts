import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { config } from './config';

fs.mkdirSync(path.dirname(config.databasePath), { recursive: true });

export const db = new Database(config.databasePath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    original_filename TEXT NOT NULL,
    encrypted_storage_key TEXT NOT NULL UNIQUE,
    file_size INTEGER NOT NULL CHECK (file_size >= 0),
    file_type TEXT NOT NULL,
    sha256_hash TEXT NOT NULL,
    encryption_nonce TEXT NOT NULL,
    auth_tag TEXT NOT NULL,
    storage_provider TEXT NOT NULL DEFAULT 'local',
    last_verified_status TEXT NOT NULL DEFAULT 'verified',
    last_verified_at TEXT,
    upload_date TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS activity_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    filename TEXT,
    timestamp TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    status TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_files_user_id ON files(user_id);
  CREATE INDEX IF NOT EXISTS idx_files_filename ON files(user_id, original_filename);
  CREATE INDEX IF NOT EXISTS idx_logs_user_id ON activity_logs(user_id, timestamp DESC);
`);

export interface UserRow {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  created_at: string;
}

export interface FileRow {
  id: number;
  user_id: number;
  original_filename: string;
  encrypted_storage_key: string;
  file_size: number;
  file_type: string;
  sha256_hash: string;
  encryption_nonce: string;
  auth_tag: string;
  storage_provider: 's3' | 'local';
  last_verified_status: 'verified' | 'modified' | 'unverified';
  last_verified_at: string | null;
  upload_date: string;
}

export interface ActivityLogRow {
  id: number;
  user_id: number;
  action: string;
  filename: string | null;
  timestamp: string;
  status: string;
}

export function logActivity(
  userId: number,
  action: string,
  filename: string | null,
  status: 'SUCCESS' | 'FAILED' | 'WARNING',
): void {
  const stmt = db.prepare(
    'INSERT INTO activity_logs (user_id, action, filename, status) VALUES (?, ?, ?, ?)',
  );
  stmt.run(userId, action, filename, status);
}
