export type NavPage =
  | 'dashboard'
  | 'upload'
  | 'files'
  | 'search'
  | 'sort'
  | 'verification'
  | 'logs'
  | 'profile';

export interface User {
  id: number;
  username: string;
  email: string;
  created_at: string;
}

export interface FileRecord {
  id: number;
  user_id?: number;
  original_filename: string;
  encrypted_storage_key?: string;
  file_size: number;
  file_type: string;
  sha256_hash: string;
  encryption_nonce?: string;
  storage_provider: 's3' | 'local';
  last_verified_status: 'verified' | 'modified' | 'unverified';
  last_verified_at: string | null;
  upload_date: string;
}

export interface ActivityLog {
  id: number;
  action: string;
  filename: string | null;
  timestamp: string;
  status: 'SUCCESS' | 'FAILED' | 'WARNING';
}

export interface DashboardData {
  stats: {
    totalFiles: number;
    totalStorageBytes: number;
    encryptedFiles: number;
    successfulIntegrityChecks: number;
    storageMode: 's3' | 'local';
  };
  recentFiles: FileRecord[];
  recentLogs: ActivityLog[];
}

export interface VerificationResult {
  fileId: number;
  filename: string;
  originalHash: string;
  computedHash: string;
  authentic: boolean;
  statusLabel: string;
  checkedAt: string;
  cipher: string;
  hashAlgorithm: string;
  storageProvider: 's3' | 'local';
  errorDetail?: string;
}

export interface SearchMetrics {
  algorithm: 'Linear Search' | 'Binary Search';
  field: string;
  query: string;
  totalScanned: number;
  comparisons: number;
  executionTimeMs: number;
  timeComplexity: string;
  spaceComplexity: string;
  sortedFirst: boolean;
  steps: string[];
}

export interface SortMetrics {
  algorithm: 'Merge Sort' | 'Quick Sort';
  sortBy: 'filename' | 'upload_date' | 'file_size';
  order: 'asc' | 'desc';
  totalItems: number;
  comparisons: number;
  swapsOrMoves: number;
  executionTimeMs: number;
  timeComplexity: string;
  spaceComplexity: string;
}

export interface SecuritySummary {
  storageMode: 's3' | 'local';
  s3Configured: boolean;
  s3Region: string;
  s3Bucket: string;
  cipherSuite: string;
  hashAlgorithm: string;
  passwordKdf: string;
  maxFileSizeMb: number;
  allowedExtensions: string[];
  storedObjectsCount: number;
}
