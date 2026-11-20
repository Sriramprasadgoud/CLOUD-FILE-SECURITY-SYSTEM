import React, { useState } from 'react';
import { ShieldCheck, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import { api } from '../api';
import type { FileRecord, VerificationResult } from '../types';
import { formatBytes, formatTimestamp } from '../utils/format';

interface VerificationViewProps {
  files: FileRecord[];
  latestResult: VerificationResult | null;
  onResult: (res: VerificationResult) => void;
  onRefreshFiles: () => Promise<void>;
}

export function VerificationView({
  files,
  latestResult,
  onResult,
  onRefreshFiles,
}: VerificationViewProps) {
  const [selectedFileId, setSelectedFileId] = useState<number | ''>(
    latestResult?.fileId ?? files[0]?.id ?? '',
  );
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async (fileIdToCheck?: number) => {
    const id = fileIdToCheck ?? Number(selectedFileId);
    if (!id) return;
    setVerifying(true);
    setError(null);
    try {
      const res = await api.verifyFile(id);
      onResult(res);
      await onRefreshFiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Integrity verification failed.');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div className="pb-5 border-b border-slate-800/80">
        <h1 className="text-2xl font-semibold text-white tracking-tight">
          Security &amp; Integrity Verification
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Fetch encrypted ciphertext from storage, decrypt with AES-256-GCM, and compare recomputed SHA-256 against the original digest.
        </p>
      </div>

      {/* Selector Card */}
      <div className="p-5 rounded-xl bg-[#0D1628] border border-slate-800/80 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={selectedFileId}
            onChange={(e) => setSelectedFileId(e.target.value ? Number(e.target.value) : '')}
            aria-label="Select file to verify"
            className="flex-1 px-3.5 py-2.5 rounded-lg bg-[#070D1A] border border-slate-800 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
          >
            {files.length === 0 ? (
              <option value="">No uploaded files available</option>
            ) : (
              files.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.original_filename} ({formatBytes(f.file_size)})
                </option>
              ))
            )}
          </select>

          <button
            type="button"
            disabled={!selectedFileId || verifying}
            onClick={() => handleVerify()}
            className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <RefreshCw className={`w-4 h-4 ${verifying ? 'animate-spin' : ''}`} />
            <span>{verifying ? 'Decrypting & Hashing…' : 'Verify SHA-256 Integrity'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-950/50 border border-red-800/70 text-red-200 text-sm">
          {error}
        </div>
      )}

      {/* Verification Output */}
      {latestResult && (
        <div className="rounded-xl bg-[#0D1628] border border-slate-800/80 overflow-hidden">
          <div
            className={`px-6 py-4 border-b border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
              latestResult.authentic ? 'bg-emerald-950/25' : 'bg-red-950/35'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {latestResult.authentic ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
              )}
              <div>
                <h2 className="text-base font-semibold text-white">
                  {latestResult.filename}
                </h2>
                <p
                  className={`text-xs font-medium ${
                    latestResult.authentic ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  Integrity Verification Status: {latestResult.statusLabel}
                </p>
              </div>
            </div>
            <span className="text-xs text-slate-400 font-mono tabular-nums">
              Checked {formatTimestamp(latestResult.checkedAt)}
            </span>
          </div>

          <div className="p-6 space-y-4">
            <div className="p-4 rounded-lg bg-[#070D1A] border border-slate-800/80">
              <span className="block text-xs font-medium text-slate-400 mb-1.5">
                Original SHA-256 Hash (Recorded Prior to Encryption)
              </span>
              <code className="block text-xs sm:text-sm font-mono text-slate-100 break-all">
                {latestResult.originalHash}
              </code>
            </div>

            <div className="p-4 rounded-lg bg-[#070D1A] border border-slate-800/80">
              <span className="block text-xs font-medium text-slate-400 mb-1.5">
                Downloaded / Decrypted SHA-256 Hash (Recomputed Live)
              </span>
              <code
                className={`block text-xs sm:text-sm font-mono break-all ${
                  latestResult.authentic ? 'text-emerald-300' : 'text-red-300'
                }`}
              >
                {latestResult.computedHash}
              </code>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 pt-1">
              <span>Cipher: {latestResult.cipher}</span>
              <span aria-hidden="true">·</span>
              <span>Digest: {latestResult.hashAlgorithm}</span>
              <span aria-hidden="true">·</span>
              <span>
                Storage: {latestResult.storageProvider === 's3' ? 'AWS S3' : 'Local Encrypted Vault'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Quick Verification Table */}
      {files.length > 0 && (
        <div className="rounded-xl bg-[#0D1628] border border-slate-800/80 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800/80 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-sky-400" />
            <h2 className="text-sm font-semibold text-white">All Vault Files Verification Ledger</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800/80 text-xs text-slate-400">
                  <th className="py-3 px-5 font-medium">File Name</th>
                  <th className="py-3 px-4 font-medium">Last Checked</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                  <th className="py-3 px-5 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-sm">
                {files.map((file) => (
                  <tr key={file.id} className="hover:bg-slate-800/30">
                    <td className="py-3 px-5 font-medium text-slate-100">
                      {file.original_filename}
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-xs text-slate-400">
                      {formatTimestamp(file.last_verified_at)}
                    </td>
                    <td className="py-3 px-4">
                      {file.last_verified_status === 'verified' ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Authentic
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-400">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Modified
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-5 text-right">
                      <button
                        type="button"
                        disabled={verifying}
                        onClick={() => {
                          setSelectedFileId(file.id);
                          handleVerify(file.id);
                        }}
                        className="px-3 py-1.5 rounded-md bg-slate-800 hover:bg-blue-600 text-slate-200 hover:text-white text-xs font-medium transition-colors"
                      >
                        Verify Now
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
