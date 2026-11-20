import React, { useEffect, useState } from 'react';
import { Shield, KeyRound, Cloud, CheckCircle2, AlertCircle } from 'lucide-react';
import { api } from '../api';
import type { SecuritySummary, User } from '../types';
import { formatTimestamp } from '../utils/format';

interface ProfileViewProps {
  user: User;
}

export function ProfileView({ user }: ProfileViewProps) {
  const [summary, setSummary] = useState<SecuritySummary | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    api.getSecuritySummary().then(setSummary).catch(() => {});
  }, []);

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (newPassword.length < 8) {
      setMessage({ type: 'error', text: 'New password must be at least 8 characters long.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match.' });
      return;
    }

    setSaving(true);
    try {
      await api.updatePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setMessage({ type: 'success', text: 'Account password updated securely.' });
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to update password.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div className="pb-5 border-b border-slate-800/80">
        <h1 className="text-2xl font-semibold text-white tracking-tight">Account &amp; Security Profile</h1>
        <p className="mt-1 text-sm text-slate-400">
          Manage credentials and inspect active cryptographic and cloud vault configuration.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Account Details & Password Change */}
        <div className="lg:col-span-6 space-y-6">
          <div className="p-6 rounded-xl bg-[#0D1628] border border-slate-800/80 space-y-3">
            <div className="flex items-center gap-2.5 text-white font-semibold text-sm">
              <Shield className="w-4 h-4 text-sky-400" />
              <span>Identity Details</span>
            </div>
            <dl className="space-y-2.5 text-sm pt-2">
              <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                <dt className="text-slate-400">Username</dt>
                <dd className="text-slate-100 font-medium">{user.username}</dd>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                <dt className="text-slate-400">Email</dt>
                <dd className="text-slate-100">{user.email}</dd>
              </div>
              <div className="flex justify-between py-1.5">
                <dt className="text-slate-400">Created At</dt>
                <dd className="text-slate-300 font-mono tabular-nums text-xs">
                  {formatTimestamp(user.created_at)}
                </dd>
              </div>
            </dl>
          </div>

          <form
            onSubmit={handlePasswordUpdate}
            className="p-6 rounded-xl bg-[#0D1628] border border-slate-800/80 space-y-4"
          >
            <div className="flex items-center gap-2.5 text-white font-semibold text-sm">
              <KeyRound className="w-4 h-4 text-sky-400" />
              <span>Rotate Account Password</span>
            </div>

            {message && (
              <div
                className={`p-3 rounded-lg border text-xs flex items-center gap-2 ${
                  message.type === 'success'
                    ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-200'
                    : 'bg-red-950/40 border-red-800/60 text-red-200'
                }`}
              >
                {message.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                )}
                <span>{message.text}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Current Password
              </label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg bg-[#070D1A] border border-slate-800 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                New Password
              </label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg bg-[#070D1A] border border-slate-800 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Confirm New Password
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg bg-[#070D1A] border border-slate-800 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium transition-colors"
            >
              {saving ? 'Updating Password…' : 'Update Password'}
            </button>
          </form>
        </div>

        {/* Cryptographic & Cloud Configuration Summary */}
        <div className="lg:col-span-6 p-6 rounded-xl bg-[#0D1628] border border-slate-800/80 space-y-4">
          <div className="flex items-center gap-2.5 text-white font-semibold text-sm">
            <Cloud className="w-4 h-4 text-sky-400" />
            <span>Cryptographic &amp; Cloud Vault Posture</span>
          </div>

          {summary ? (
            <dl className="space-y-3 text-xs pt-2">
              <div className="py-2 border-b border-slate-800/60">
                <dt className="text-slate-400">Storage Backend</dt>
                <dd className="mt-0.5 text-slate-100 font-medium">
                  {summary.s3Configured
                    ? `AWS S3 Private Bucket (${summary.s3Bucket} · ${summary.s3Region})`
                    : 'Local Encrypted Vault (Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET for S3)'}
                </dd>
              </div>
              <div className="py-2 border-b border-slate-800/60">
                <dt className="text-slate-400">File Encryption Cipher</dt>
                <dd className="mt-0.5 text-slate-100 font-mono">{summary.cipherSuite}</dd>
              </div>
              <div className="py-2 border-b border-slate-800/60">
                <dt className="text-slate-400">Integrity Digest</dt>
                <dd className="mt-0.5 text-slate-100 font-mono">{summary.hashAlgorithm}</dd>
              </div>
              <div className="py-2 border-b border-slate-800/60">
                <dt className="text-slate-400">Password Key Derivation</dt>
                <dd className="mt-0.5 text-slate-100 font-mono">{summary.passwordKdf}</dd>
              </div>
              <div className="py-2 border-b border-slate-800/60">
                <dt className="text-slate-400">Upload Size Limit</dt>
                <dd className="mt-0.5 text-slate-100 font-mono tabular-nums">
                  {summary.maxFileSizeMb} MB per file
                </dd>
              </div>
              <div className="py-2">
                <dt className="text-slate-400 mb-1.5">Allowed File Extensions</dt>
                <dd className="text-slate-300 font-mono leading-relaxed">
                  {summary.allowedExtensions.join(', ')}
                </dd>
              </div>
            </dl>
          ) : (
            <div className="h-48 rounded bg-slate-800/40 animate-pulse" />
          )}
        </div>
      </div>
    </div>
  );
}
