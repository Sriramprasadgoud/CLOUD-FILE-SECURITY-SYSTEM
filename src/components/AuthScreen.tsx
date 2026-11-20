import React, { useState } from 'react';
import { Lock, ShieldCheck, AlertCircle, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { api } from '../api';
import type { User } from '../types';

interface AuthScreenProps {
  onSuccess: (user: User) => void;
}

export function AuthScreen({ onSuccess }: AuthScreenProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === 'register') {
      if (username.trim().length < 3) {
        setError('Username must be at least 3 characters.');
        return;
      }
      if (!email.includes('@')) {
        setError('Please enter a valid email address.');
        return;
      }
      if (password.length < 8) {
        setError('Password must be at least 8 characters long.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
    } else {
      if (!identifier.trim() || !password) {
        setError('Please enter your username/email and password.');
        return;
      }
    }

    setLoading(true);
    try {
      const response =
        mode === 'login'
          ? await api.login(identifier.trim(), password)
          : await api.register(username.trim(), email.trim(), password);
      onSuccess(response.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070D1A] text-slate-100 grid lg:grid-cols-12">
      {/* Left Architectural Vault Showcase */}
      <div className="hidden lg:flex lg:col-span-5 relative bg-[#0B1325] border-r border-slate-800/80 flex-col justify-between overflow-hidden">
        <div className="relative z-10 p-10">
          <div className="flex items-center gap-3 text-slate-100">
            <div className="w-9 h-9 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <span className="font-semibold text-base tracking-tight">Cloud File Security System</span>
          </div>

          <div className="mt-14 max-w-md">
            <h1 className="text-3xl font-semibold tracking-tight text-white leading-tight">
              Authenticated cloud storage built on zero-plaintext architecture
            </h1>
            <p className="mt-4 text-sm text-slate-400 leading-relaxed">
              Every file is fingerprinted with SHA-256, sealed with AES-256-GCM authenticated encryption using a unique 96-bit nonce, and stored strictly as ciphertext.
            </p>
          </div>
        </div>

        <div className="relative h-80 mx-10 mb-10 rounded-xl overflow-hidden border border-slate-800/80 bg-[#070D1A]">
          <img
            src="/src/assets/images/vault_security_panel_1795145887674.jpg"
            alt="Architectural cryptographic vault"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover opacity-85"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#070D1A] via-[#070D1A]/30 to-transparent" />
          <div className="absolute bottom-5 left-5 right-5 flex items-center justify-between text-xs text-slate-300 font-mono tabular-nums">
            <span>AES-256-GCM</span>
            <span aria-hidden="true">·</span>
            <span>SHA-256</span>
            <span aria-hidden="true">·</span>
            <span>AWS S3 Vault</span>
          </div>
        </div>
      </div>

      {/* Right Authentication Form */}
      <div className="lg:col-span-7 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          <div className="flex lg:hidden items-center gap-3 mb-8">
            <div className="w-9 h-9 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <span className="font-semibold text-base tracking-tight text-white">
              Cloud File Security System
            </span>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-white tracking-tight">
              {mode === 'login' ? 'Sign in to your vault' : 'Create a secure account'}
            </h2>
            <p className="mt-1.5 text-sm text-slate-400">
              {mode === 'login'
                ? 'Authenticate to access your encrypted cloud files and integrity logs.'
                : 'Register an isolated user workspace with per-user file access controls.'}
            </p>
          </div>

          {/* Segmented Tab Switcher */}
          <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-[#0D1628] border border-slate-800/80 mb-6">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`py-2 px-4 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                mode === 'login'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
              }}
              className={`py-2 px-4 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                mode === 'register'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Register
            </button>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-5 p-3.5 rounded-lg bg-red-950/50 border border-red-800/70 text-red-200 text-sm flex items-start gap-2.5"
            >
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'login' ? (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Username or Email
                </label>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Enter username or email"
                  autoComplete="username"
                  required
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[#0D1628] border border-slate-700/80 text-slate-100 placeholder:text-slate-500 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Username
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. security_analyst"
                    autoComplete="username"
                    required
                    className="w-full px-3.5 py-2.5 rounded-lg bg-[#0D1628] border border-slate-700/80 text-slate-100 placeholder:text-slate-500 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="analyst@example.edu"
                    autoComplete="email"
                    required
                    className="w-full px-3.5 py-2.5 rounded-lg bg-[#0D1628] border border-slate-700/80 text-slate-100 placeholder:text-slate-500 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'register' ? 'Minimum 8 characters' : 'Enter your password'}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  required
                  className="w-full px-3.5 py-2.5 pr-10 rounded-lg bg-[#0D1628] border border-slate-700/80 text-slate-100 placeholder:text-slate-500 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {mode === 'register' && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Confirm Password
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  autoComplete="new-password"
                  required
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[#0D1628] border border-slate-700/80 text-slate-100 placeholder:text-slate-500 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-medium text-sm transition-colors flex items-center justify-center gap-2"
            >
              <Lock className="w-4 h-4" />
              <span>
                {loading
                  ? mode === 'login'
                    ? 'Authenticating…'
                    : 'Creating Account…'
                  : mode === 'login'
                    ? 'Sign In to Vault'
                    : 'Create Encrypted Vault'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <p className="mt-8 text-xs text-slate-500 leading-relaxed">
            Protected by scrypt key derivation, CSRF token verification, HTTP-only signed session cookies, and strict per-user file ownership enforcement.
          </p>
        </div>
      </div>
    </div>
  );
}
