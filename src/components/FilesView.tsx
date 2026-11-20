import React, { useMemo, useState } from 'react';
import {
  Download,
  ShieldCheck,
  Trash2,
  Search,
  CheckCircle2,
  AlertTriangle,
  Lock,
  ChevronLeft,
  ChevronRight,
  UploadCloud,
} from 'lucide-react';
import { api } from '../api';
import type { FileRecord, VerificationResult } from '../types';
import { formatBytes, formatTimestamp, getFileExtension } from '../utils/format';

interface FilesViewProps {
  files: FileRecord[];
  loading: boolean;
  onRefresh: () => Promise<void>;
  onGoToUpload: () => void;
  onVerified: (result: VerificationResult) => void;
}

const PAGE_SIZE = 8;

export function FilesView({
  files,
  loading,
  onRefresh,
  onGoToUpload,
  onVerified,
}: FilesViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'documents' | 'images' | 'archives' | 'code'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'verified' | 'modified'>('all');
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const filteredFiles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return files.filter((file) => {
      if (q && !file.original_filename.toLowerCase().includes(q)) {
        return false;
      }
      if (statusFilter !== 'all' && file.last_verified_status !== statusFilter) {
        return false;
      }
      if (typeFilter !== 'all') {
        const ext = getFileExtension(file.original_filename);
        const docExts = new Set(['pdf', 'txt', 'md', 'csv', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx']);
        const imgExts = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg']);
        const archExts = new Set(['zip', 'tar', 'gz']);
        const codeExts = new Set(['py', 'js', 'ts', 'html', 'css', 'json', 'xml', 'yaml', 'yml', 'sql']);
        if (typeFilter === 'documents' && !docExts.has(ext)) return false;
        if (typeFilter === 'images' && !imgExts.has(ext)) return false;
        if (typeFilter === 'archives' && !archExts.has(ext)) return false;
        if (typeFilter === 'code' && !codeExts.has(ext)) return false;
      }
      return true;
    });
  }, [files, searchQuery, typeFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredFiles.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedFiles = filteredFiles.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const handleDownload = async (file: FileRecord) => {
    setBusyId(file.id);
    setBanner(null);
    try {
      const info = await api.downloadFile(file.id, file.original_filename);
      setBanner({
        type: info.integrityStatus === 'MODIFIED' ? 'error' : 'success',
        text: `Decrypted & downloaded "${file.original_filename}" · Integrity: ${info.integrityStatus || 'AUTHENTIC'}`,
      });
      await onRefresh();
    } catch (err) {
      setBanner({
        type: 'error',
        text: err instanceof Error ? err.message : 'Download failed.',
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleVerify = async (file: FileRecord) => {
    setBusyId(file.id);
    setBanner(null);
    try {
      const res = await api.verifyFile(file.id);
      onVerified(res);
      setBanner({
        type: res.authentic ? 'success' : 'error',
        text: `${res.filename}: ${res.statusLabel}`,
      });
      await onRefresh();
    } catch (err) {
      setBanner({
        type: 'error',
        text: err instanceof Error ? err.message : 'Verification failed.',
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (file: FileRecord) => {
    setBusyId(file.id);
    setBanner(null);
    try {
      await api.deleteFile(file.id);
      setBanner({
        type: 'success',
        text: `Deleted encrypted object and metadata for "${file.original_filename}".`,
      });
      await onRefresh();
    } catch (err) {
      setBanner({
        type: 'error',
        text: err instanceof Error ? err.message : 'Deletion failed.',
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800/80">
        <div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">My Encrypted Files</h1>
          <p className="mt-1 text-sm text-slate-400">
            Download with live AES-256-GCM decryption, verify SHA-256 integrity, or purge cloud objects.
          </p>
        </div>
        <button
          type="button"
          onClick={onGoToUpload}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors inline-flex items-center gap-2 whitespace-nowrap self-start sm:self-auto"
        >
          <UploadCloud className="w-4 h-4" />
          <span>Upload File</span>
        </button>
      </div>

      {banner && (
        <div
          role="status"
          className={`p-3.5 rounded-xl border text-sm flex items-center justify-between gap-3 ${
            banner.type === 'success'
              ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-200'
              : 'bg-red-950/40 border-red-800/60 text-red-200'
          }`}
        >
          <span>{banner.text}</span>
          <button
            type="button"
            onClick={() => setBanner(null)}
            className="text-xs underline opacity-80 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Filter by filename…"
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-[#0D1628] border border-slate-800 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value as typeof typeFilter);
              setPage(1);
            }}
            aria-label="Filter by file category"
            className="px-3 py-2 rounded-lg bg-[#0D1628] border border-slate-800 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option value="all">All File Types</option>
            <option value="documents">Documents</option>
            <option value="images">Images</option>
            <option value="archives">Archives</option>
            <option value="code">Code &amp; Config</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as typeof statusFilter);
              setPage(1);
            }}
            aria-label="Filter by integrity status"
            className="px-3 py-2 rounded-lg bg-[#0D1628] border border-slate-800 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Integrity States</option>
            <option value="verified">Authentic Only</option>
            <option value="modified">Modified Only</option>
          </select>
        </div>
      </div>

      {/* Files Table */}
      <div className="rounded-xl bg-[#0D1628] border border-slate-800/80 overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-10 rounded bg-slate-800/50 animate-pulse" />
            ))}
          </div>
        ) : pagedFiles.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm font-medium text-slate-200">
              {files.length === 0
                ? 'Your encrypted cloud vault is empty.'
                : 'No files match the current filter criteria.'}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {files.length === 0
                ? 'Upload a file to encrypt it with AES-256-GCM and record its SHA-256 digest.'
                : 'Adjust your search term or category filters.'}
            </p>
            {files.length === 0 && (
              <button
                type="button"
                onClick={onGoToUpload}
                className="mt-4 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
              >
                Upload First File
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800/80 text-xs text-slate-400">
                  <th className="py-3.5 px-5 font-medium">File Name</th>
                  <th className="py-3.5 px-4 font-medium">File Type</th>
                  <th className="py-3.5 px-4 font-medium text-right">File Size</th>
                  <th className="py-3.5 px-4 font-medium">Upload Date</th>
                  <th className="py-3.5 px-4 font-medium">Encryption Status</th>
                  <th className="py-3.5 px-4 font-medium">Integrity Status</th>
                  <th className="py-3.5 px-5 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-sm">
                {pagedFiles.map((file) => {
                  const isBusy = busyId === file.id;
                  return (
                    <tr key={file.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-5 font-medium text-slate-100 max-w-[220px] truncate">
                        {file.original_filename}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-400 font-mono whitespace-nowrap">
                        {getFileExtension(file.original_filename).toUpperCase()}
                      </td>
                      <td className="py-3 px-4 text-right text-xs text-slate-300 font-mono tabular-nums whitespace-nowrap">
                        {formatBytes(file.file_size)}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-400 font-mono tabular-nums whitespace-nowrap">
                        {formatTimestamp(file.upload_date)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 text-xs text-sky-400 font-medium">
                          <Lock className="w-3.5 h-3.5" />
                          AES-256-GCM · {file.storage_provider === 's3' ? 'S3' : 'Vault'}
                        </span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {file.last_verified_status === 'verified' ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Authentic
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs text-red-400 font-medium">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Modified
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleDownload(file)}
                            title="Decrypt and Download"
                            className="px-2.5 py-1.5 rounded-md bg-slate-800 hover:bg-blue-600 text-slate-200 hover:text-white text-xs font-medium transition-colors inline-flex items-center gap-1"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Download</span>
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleVerify(file)}
                            title="Verify SHA-256 Integrity"
                            className="px-2.5 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors inline-flex items-center gap-1"
                          >
                            <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
                            <span>Verify</span>
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleDelete(file)}
                            title="Delete File"
                            className="px-2.5 py-1.5 rounded-md bg-slate-800 hover:bg-red-700 text-slate-300 hover:text-white text-xs font-medium transition-colors inline-flex items-center gap-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {filteredFiles.length > 0 && (
          <div className="px-5 py-3.5 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span className="font-mono tabular-nums">
              Showing {(safePage - 1) * PAGE_SIZE + 1}–
              {Math.min(safePage * PAGE_SIZE, filteredFiles.length)} of {filteredFiles.length} files
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-md border border-slate-800 text-slate-300 hover:bg-slate-800 disabled:opacity-40"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-mono tabular-nums px-2">
                Page {safePage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-md border border-slate-800 text-slate-300 hover:bg-slate-800 disabled:opacity-40"
                aria-label="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
