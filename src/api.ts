import type {
  ActivityLog,
  DashboardData,
  FileRecord,
  SearchMetrics,
  SecuritySummary,
  SortMetrics,
  User,
  VerificationResult,
} from './types';

let cachedCsrfToken: string | null = null;
const SESSION_STORAGE_KEY = 'cfss_session_token';

function getStoredSessionToken(): string | null {
  try {
    return sessionStorage.getItem(SESSION_STORAGE_KEY);
  } catch {
    return null;
  }
}

function setStoredSessionToken(token: string | null): void {
  try {
    if (token) {
      sessionStorage.setItem(SESSION_STORAGE_KEY, token);
    } else {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    }
  } catch {
    // Ignore storage restriction errors
  }
}

export async function ensureCsrfToken(forceRefresh = false): Promise<string> {
  if (cachedCsrfToken && !forceRefresh) {
    return cachedCsrfToken;
  }
  const res = await fetch('/api/auth/csrf', { credentials: 'include' });
  if (!res.ok) {
    throw new Error('Failed to initialize security CSRF token.');
  }
  const data = (await res.json()) as { csrfToken: string };
  cachedCsrfToken = data.csrfToken;
  return cachedCsrfToken;
}

async function requestJson<T>(url: string, options: RequestInit = {}, retriedCsrf = false): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();
  const headers = new Headers(options.headers || {});

  const sessionToken = getStoredSessionToken();
  if (sessionToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${sessionToken}`);
  }

  if (method !== 'GET' && method !== 'HEAD') {
    const token = await ensureCsrfToken(retriedCsrf);
    headers.set('X-CSRF-Token', token);
  }

  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (res.status === 403 && !retriedCsrf && method !== 'GET' && method !== 'HEAD') {
    cachedCsrfToken = null;
    return requestJson<T>(url, options, true);
  }

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const payload = (await res.json()) as { error?: string };
      if (payload.error) message = payload.error;
    } catch {
      // Fallback to status message
    }
    throw new Error(message);
  }

  return (await res.json()) as T;
}

export const api = {
  async getMe(): Promise<{ user: User }> {
    return requestJson('/api/auth/me');
  },

  async register(username: string, email: string, password: string): Promise<{ user: User }> {
    const res = await requestJson<{ user: User; sessionToken?: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password }),
    });
    if (res.sessionToken) setStoredSessionToken(res.sessionToken);
    return { user: res.user };
  },

  async login(identifier: string, password: string): Promise<{ user: User }> {
    const res = await requestJson<{ user: User; sessionToken?: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    });
    if (res.sessionToken) setStoredSessionToken(res.sessionToken);
    return { user: res.user };
  },

  async logout(): Promise<void> {
    try {
      await requestJson('/api/auth/logout', { method: 'POST' });
    } finally {
      setStoredSessionToken(null);
      cachedCsrfToken = null;
    }
  },

  async getDashboard(): Promise<DashboardData> {
    return requestJson('/api/dashboard');
  },

  async getFiles(): Promise<{ files: FileRecord[]; storageMode: 's3' | 'local' }> {
    return requestJson('/api/files');
  },

  async uploadFile(
    file: File,
    onProgress?: (pct: number) => void,
  ): Promise<{
    file: FileRecord;
    encryption: {
      algorithm: string;
      nonceHex: string;
      sha256Hash: string;
      storageProvider: 's3' | 'local';
    };
  }> {
    const token = await ensureCsrfToken();
    const sessionToken = getStoredSessionToken();
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/files/upload');
      xhr.withCredentials = true;
      xhr.setRequestHeader('X-CSRF-Token', token);
      if (sessionToken) {
        xhr.setRequestHeader('Authorization', `Bearer ${sessionToken}`);
      }

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) {
          const pct = Math.round((event.loaded / event.total) * 100);
          onProgress(pct);
        }
      };

      xhr.onload = () => {
        try {
          const json = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(json);
          } else {
            reject(new Error(json.error || `Upload failed (${xhr.status})`));
          }
        } catch {
          reject(new Error(`Upload failed (${xhr.status})`));
        }
      };

      xhr.onerror = () => reject(new Error('Network error while uploading file.'));

      const form = new FormData();
      form.append('file', file);
      xhr.send(form);
    });
  },

  async downloadFile(fileId: number, filename: string): Promise<{
    originalHash: string | null;
    computedHash: string | null;
    integrityStatus: string | null;
  }> {
    const headers = new Headers();
    const sessionToken = getStoredSessionToken();
    if (sessionToken) {
      headers.set('Authorization', `Bearer ${sessionToken}`);
    }
    const res = await fetch(`/api/files/${fileId}/download`, {
      credentials: 'include',
      headers,
    });

    if (!res.ok) {
      let message = `Download failed (${res.status})`;
      try {
        const json = (await res.json()) as { error?: string };
        if (json.error) message = json.error;
      } catch {
        // ignore
      }
      throw new Error(message);
    }

    const originalHash = res.headers.get('X-Original-SHA256');
    const computedHash = res.headers.get('X-Computed-SHA256');
    const integrityStatus = res.headers.get('X-Integrity-Status');

    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);

    return { originalHash, computedHash, integrityStatus };
  },

  async verifyFile(fileId: number): Promise<VerificationResult> {
    return requestJson(`/api/files/${fileId}/verify`, { method: 'POST' });
  },

  async deleteFile(fileId: number): Promise<void> {
    await requestJson(`/api/files/${fileId}`, { method: 'DELETE' });
  },

  async searchFiles(
    algorithm: 'linear' | 'binary',
    query: string,
    field: 'filename' | 'extension' | 'file_type' = 'filename',
  ): Promise<{ results: FileRecord[]; metrics: SearchMetrics }> {
    const params = new URLSearchParams({
      algorithm,
      q: query,
      field,
    });
    return requestJson(`/api/algorithms/search?${params.toString()}`);
  },

  async sortFiles(
    algorithm: 'merge' | 'quick',
    sortBy: 'filename' | 'upload_date' | 'file_size',
    order: 'asc' | 'desc',
  ): Promise<{ results: FileRecord[]; metrics: SortMetrics }> {
    const params = new URLSearchParams({
      algorithm,
      sortBy,
      order,
    });
    return requestJson(`/api/algorithms/sort?${params.toString()}`);
  },

  async getLogs(actionFilter = ''): Promise<{ logs: ActivityLog[] }> {
    const params = actionFilter ? `?action=${encodeURIComponent(actionFilter)}` : '';
    return requestJson(`/api/logs${params}`);
  },

  async updatePassword(currentPassword: string, newPassword: string): Promise<void> {
    await requestJson('/api/profile/password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },

  async getSecuritySummary(): Promise<SecuritySummary> {
    return requestJson('/api/profile/security-summary');
  },
};
