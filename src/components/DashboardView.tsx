import React from 'react';
import {
  FileLock2,
  HardDrive,
  Lock,
  ShieldCheck,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Cloud,
} from 'lucide-react';
import type { DashboardData, NavPage } from '../types';
import { formatBytes, formatTimestamp, truncateHash } from '../utils/format';

interface DashboardViewProps {
  data: DashboardData | null;
  loading: boolean;
  onNavigate: (page: NavPage) => void;
}

export function DashboardView({ data, loading, onNavigate }: DashboardViewProps) {
  if (loading && !data) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((idx) => (
            <div
              key={idx}
              className="h-28 rounded-xl bg-[#0D1628] border border-slate-800/80 animate-pulse"
            />
          ))}
        </div>
        <div className="h-72 rounded-xl bg-[#0D1628] border border-slate-800/80 animate-pulse" />
      </div>
    );
  }

  const stats = data?.stats ?? {
    totalFiles: 0,
    totalStorageBytes: 0,
    encryptedFiles: 0,
    successfulIntegrityChecks: 0,
    storageMode: 'local',
  };
  const recentFiles = data?.recentFiles ?? [];
  const recentLogs = data?.recentLogs ?? [];

  const statCards = [
    {
      label: 'Total Files',
      value: String(stats.totalFiles),
      detail: 'Isolated per-user vault',
      icon: FileLock2,
    },
    {
      label: 'Total Storage Used',
      value: formatBytes(stats.totalStorageBytes),
      detail: stats.storageMode === 's3' ? 'AWS S3 Private Bucket' : 'Local Encrypted Vault',
      icon: HardDrive,
    },
    {
      label: 'Encrypted Files',
      value: String(stats.encryptedFiles),
      detail: 'AES-256-GCM authenticated',
      icon: Lock,
    },
    {
      label: 'Successful Integrity Checks',
      value: String(stats.successfulIntegrityChecks),
      detail: 'SHA-256 hash verified',
      icon: ShieldCheck,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
        <div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">
            Security Operations Overview
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span className="inline-flex items-center gap-1.5 text-sky-400 font-medium">
              <Cloud className="w-3.5 h-3.5" />
              {stats.storageMode === 's3'
                ? 'Primary Cloud Storage: AWS S3 Private Bucket'
                : 'Storage Mode: Local Encrypted Vault (AWS S3 Ready)'}
            </span>
            <span aria-hidden="true">·</span>
            <span>Cipher: AES-256-GCM</span>
            <span aria-hidden="true">·</span>
            <span>Digest: SHA-256</span>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('verification')}
            className="px-4 py-2 rounded-lg border border-slate-700 text-slate-200 hover:bg-slate-800 text-sm font-medium transition-colors whitespace-nowrap"
          >
            Verify Integrity
          </button>
          <button
            type="button"
            onClick={() => onNavigate('upload')}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors inline-flex items-center gap-2 whitespace-nowrap"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Encrypt &amp; Upload</span>
          </button>
        </div>
      </div>

      {/* 4-Column KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="p-5 rounded-xl bg-[#0D1628] border border-slate-800/80 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-400">{card.label}</span>
                <Icon className="w-4 h-4 text-sky-400 shrink-0" />
              </div>
              <div className="mt-3 text-2xl font-semibold text-white font-mono tabular-nums">
                {card.value}
              </div>
              <div className="mt-1.5 text-xs text-slate-400">{card.detail}</div>
            </div>
          );
        })}
      </div>

      {/* Recent Files + Recent Activity */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-7 rounded-xl bg-[#0D1628] border border-slate-800/80 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800/80 flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">Recent Encrypted Files</h2>
            <button
              type="button"
              onClick={() => onNavigate('files')}
              className="text-xs font-medium text-sky-400 hover:text-sky-300 inline-flex items-center gap-1 whitespace-nowrap"
            >
              <span>View all files</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {recentFiles.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-slate-300">No encrypted files uploaded yet.</p>
              <p className="mt-1 text-xs text-slate-400">
                Upload a document to compute its SHA-256 hash and store its AES-256-GCM ciphertext.
              </p>
              <button
                type="button"
                onClick={() => onNavigate('upload')}
                className="mt-4 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
              >
                Upload First File
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800/80 text-xs text-slate-400">
                    <th className="py-3 px-5 font-medium">File Name</th>
                    <th className="py-3 px-4 font-medium text-right">Size</th>
                    <th className="py-3 px-4 font-medium">SHA-256</th>
                    <th className="py-3 px-5 font-medium">Integrity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-sm">
                  {recentFiles.map((file) => (
                    <tr key={file.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-5 font-medium text-slate-100 max-w-[220px] truncate">
                        {file.original_filename}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-xs text-slate-300 whitespace-nowrap">
                        {formatBytes(file.file_size)}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-400 whitespace-nowrap">
                        {truncateHash(file.sha256_hash, 8, 6)}
                      </td>
                      <td className="py-3 px-5 whitespace-nowrap">
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="xl:col-span-5 rounded-xl bg-[#0D1628] border border-slate-800/80 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800/80 flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">Recent Audit Activity</h2>
            <button
              type="button"
              onClick={() => onNavigate('logs')}
              className="text-xs font-medium text-sky-400 hover:text-sky-300 inline-flex items-center gap-1 whitespace-nowrap"
            >
              <span>Full logs</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {recentLogs.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">
              No security events recorded yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-800/60">
              {recentLogs.map((log) => (
                <div
                  key={log.id}
                  className="px-5 py-3 flex items-center justify-between gap-3 text-sm"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-200 truncate">
                        {log.action.replace(/_/g, ' ')}
                      </span>
                      {log.filename && (
                        <>
                          <span aria-hidden="true" className="text-slate-600">
                            ·
                          </span>
                          <span className="text-xs text-slate-400 truncate max-w-[160px]">
                            {log.filename}
                          </span>
                        </>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 font-mono tabular-nums mt-0.5">
                      {formatTimestamp(log.timestamp)}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-medium shrink-0 ${
                      log.status === 'SUCCESS'
                        ? 'text-emerald-400'
                        : log.status === 'WARNING'
                          ? 'text-amber-400'
                          : 'text-red-400'
                    }`}
                  >
                    {log.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
