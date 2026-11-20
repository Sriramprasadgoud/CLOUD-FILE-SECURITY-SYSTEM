import React, { useRef, useState } from 'react';
import {
  UploadCloud,
  FileText,
  Lock,
  Cloud,
  CheckCircle2,
  AlertCircle,
  X,
} from 'lucide-react';
import { api } from '../api';
import type { FileRecord } from '../types';
import { formatBytes } from '../utils/format';

interface UploadViewProps {
  storageMode: 's3' | 'local';
  onUploaded: (file: FileRecord) => void;
  onGoToFiles: () => void;
}

export function UploadView({ storageMode, onUploaded, onGoToFiles }: UploadViewProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<{
    file: FileRecord;
    nonceHex: string;
    sha256Hash: string;
    storageProvider: 's3' | 'local';
  } | null>(null);

  const handleFileChosen = (file: File | undefined) => {
    if (!file) return;
    setSelectedFile(file);
    setStage('idle');
    setProgress(0);
    setError(null);
    setReceipt(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    handleFileChosen(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setStage('uploading');
    setProgress(10);
    setError(null);

    try {
      const res = await api.uploadFile(selectedFile, (pct) => {
        setProgress(Math.max(15, Math.min(95, pct)));
      });
      setProgress(100);
      setStage('done');
      setReceipt({
        file: res.file,
        nonceHex: res.encryption.nonceHex,
        sha256Hash: res.encryption.sha256Hash,
        storageProvider: res.encryption.storageProvider,
      });
      onUploaded(res.file);
    } catch (err) {
      setStage('error');
      setError(err instanceof Error ? err.message : 'Encryption and upload failed.');
    }
  };

  const encryptionStatusText =
    stage === 'idle'
      ? 'Ready — SHA-256 + AES-256-GCM will run before storage'
      : stage === 'uploading'
        ? 'Encrypting with unique 96-bit nonce (AES-256-GCM)…'
        : stage === 'done'
          ? 'Encrypted successfully (AES-256-GCM verified)'
          : 'Encryption aborted';

  const cloudStatusText =
    stage === 'idle'
      ? storageMode === 's3'
        ? 'Target: Private AWS S3 Bucket (Server-Side AES256)'
        : 'Target: Local Encrypted Vault (Private Directory)'
      : stage === 'uploading'
        ? 'Transferring ciphertext payload…'
        : stage === 'done'
          ? receipt?.storageProvider === 's3'
            ? 'Stored securely in AWS S3 private bucket'
            : 'Stored securely in Local Encrypted Vault'
          : 'Upload failed';

  return (
    <div className="max-w-4xl space-y-6">
      <div className="pb-5 border-b border-slate-800/80">
        <h1 className="text-2xl font-semibold text-white tracking-tight">
          Encrypt &amp; Upload File
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Plaintext is hashed with SHA-256 and encrypted using AES-256-GCM before touching cloud storage.
        </p>
      </div>

      {/* Drag and Drop Area */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        className={`rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
          dragActive
            ? 'border-blue-500 bg-blue-950/20'
            : 'border-slate-700/80 bg-[#0D1628] hover:border-slate-600'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={(e) => handleFileChosen(e.target.files?.[0])}
        />

        <div className="mx-auto w-12 h-12 rounded-xl bg-blue-600/15 border border-blue-500/30 flex items-center justify-center text-sky-400">
          <UploadCloud className="w-6 h-6" />
        </div>

        <h2 className="mt-4 text-base font-semibold text-white">
          Drag and drop a file here, or browse from disk
        </h2>
        <p className="mt-1.5 text-xs text-slate-400">
          Maximum size 25 MB · Executable binaries are blocked by security policy
        </p>

        <div className="mt-5 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors whitespace-nowrap"
          >
            Browse Files
          </button>
          {selectedFile && stage !== 'uploading' && (
            <button
              type="button"
              onClick={() => {
                setSelectedFile(null);
                setStage('idle');
                setProgress(0);
                setReceipt(null);
                setError(null);
              }}
              className="px-3.5 py-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm font-medium transition-colors inline-flex items-center gap-1.5"
            >
              <X className="w-4 h-4" />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* Selected File Metadata & Pipeline Status */}
      {selectedFile && (
        <div className="rounded-xl bg-[#0D1628] border border-slate-800/80 p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800/80">
            <div className="flex items-start gap-3.5 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-sky-400 shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">
                  {selectedFile.name}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400 font-mono tabular-nums">
                  <span>{formatBytes(selectedFile.size)}</span>
                  <span aria-hidden="true">·</span>
                  <span>{selectedFile.type || 'application/octet-stream'}</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              disabled={stage === 'uploading' || stage === 'done'}
              onClick={handleUpload}
              className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium transition-colors whitespace-nowrap shrink-0"
            >
              {stage === 'uploading'
                ? 'Encrypting & Uploading…'
                : stage === 'done'
                  ? 'Upload Complete'
                  : 'Encrypt & Upload to Vault'}
            </button>
          </div>

          {/* Progress Bar */}
          <div>
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-slate-300 font-medium">Upload Progress</span>
              <span className="font-mono tabular-nums text-sky-400">{progress}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
              <div
                className={`h-full transition-all duration-200 ${
                  stage === 'error'
                    ? 'bg-red-500'
                    : stage === 'done'
                      ? 'bg-emerald-500'
                      : 'bg-blue-500'
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Encryption & Cloud Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="p-4 rounded-lg bg-[#070D1A] border border-slate-800/80 flex items-start gap-3">
              <Lock className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-slate-300">Encryption Status</p>
                <p className="mt-1 text-xs text-slate-400">{encryptionStatusText}</p>
              </div>
            </div>
            <div className="p-4 rounded-lg bg-[#070D1A] border border-slate-800/80 flex items-start gap-3">
              <Cloud className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-slate-300">Cloud Upload Status</p>
                <p className="mt-1 text-xs text-slate-400">{cloudStatusText}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-red-950/50 border border-red-800/70 text-red-200 text-sm flex items-start gap-3"
        >
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Upload Blocked or Failed</p>
            <p className="text-xs text-red-300 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {receipt && (
        <div className="p-5 rounded-xl bg-emerald-950/30 border border-emerald-800/60 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-emerald-300 font-medium text-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <span>File encrypted and stored securely</span>
            </div>
            <button
              type="button"
              onClick={onGoToFiles}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors"
            >
              Open My Files
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
            <div className="p-3 rounded-lg bg-[#070D1A] border border-slate-800">
              <span className="block text-slate-400 font-sans mb-1">Original SHA-256 Digest</span>
              <span className="text-slate-200 break-all">{receipt.sha256Hash}</span>
            </div>
            <div className="p-3 rounded-lg bg-[#070D1A] border border-slate-800">
              <span className="block text-slate-400 font-sans mb-1">Unique AES-256-GCM Nonce</span>
              <span className="text-slate-200 break-all">{receipt.nonceHex}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
