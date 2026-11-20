import React, { useCallback, useEffect, useState } from 'react';
import { Menu, UploadCloud } from 'lucide-react';
import { api, ensureCsrfToken } from './api';
import { AuthScreen } from './components/AuthScreen';
import { DashboardView } from './components/DashboardView';
import { FilesView } from './components/FilesView';
import { LogsView } from './components/LogsView';
import { ProfileView } from './components/ProfileView';
import { SearchView } from './components/SearchView';
import { Sidebar } from './components/Sidebar';
import { SortView } from './components/SortView';
import { UploadView } from './components/UploadView';
import { VerificationView } from './components/VerificationView';
import type { DashboardData, FileRecord, NavPage, User, VerificationResult } from './types';

const PAGE_LABELS: Record<NavPage, string> = {
  dashboard: 'Dashboard',
  upload: 'Upload Files',
  files: 'My Files',
  search: 'Search Files',
  sort: 'Sort Files',
  verification: 'Security Verification',
  logs: 'Activity Logs',
  profile: 'Profile',
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [activePage, setActivePage] = useState<NavPage>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [storageMode, setStorageMode] = useState<'s3' | 'local'>('local');
  const [dataLoading, setDataLoading] = useState(false);
  const [latestVerification, setLatestVerification] = useState<VerificationResult | null>(null);

  const refreshWorkspace = useCallback(async () => {
    setDataLoading(true);
    try {
      const [dash, fileRes] = await Promise.all([api.getDashboard(), api.getFiles()]);
      setDashboardData(dash);
      setFiles(fileRes.files);
      setStorageMode(fileRes.storageMode);
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    async function boot() {
      try {
        await ensureCsrfToken();
        const me = await api.getMe();
        if (mounted) {
          setUser(me.user);
        }
      } catch {
        if (mounted) {
          setUser(null);
        }
      } finally {
        if (mounted) {
          setAuthChecking(false);
        }
      }
    }
    boot();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (user) {
      refreshWorkspace();
    }
  }, [user, refreshWorkspace]);

  const handleLogout = async () => {
    try {
      await api.logout();
    } finally {
      setUser(null);
      setDashboardData(null);
      setFiles([]);
      setLatestVerification(null);
      setActivePage('dashboard');
    }
  };

  if (authChecking) {
    return (
      <div className="min-h-screen bg-[#070D1A] flex items-center justify-center text-sm text-slate-400">
        Initializing encrypted session…
      </div>
    );
  }

  if (!user) {
    return (
      <AuthScreen
        onSuccess={(authenticatedUser) => {
          setUser(authenticatedUser);
          setActivePage('dashboard');
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#070D1A] text-slate-100 flex">
      <Sidebar
        activePage={activePage}
        onNavigate={setActivePage}
        onLogout={handleLogout}
        user={user}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar (Breadcrumb + 1 Primary Action) */}
        <header className="h-16 px-4 sm:px-8 border-b border-slate-800/80 bg-[#0B1325]/80 backdrop-blur-sm flex items-center justify-between gap-4 shrink-0 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 rounded-lg text-slate-300 hover:bg-slate-800"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm truncate">
              <span className="text-slate-400">Cloud Vault</span>
              <span aria-hidden="true" className="text-slate-600">
                /
              </span>
              <span className="font-medium text-white truncate">
                {PAGE_LABELS[activePage]}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setActivePage('upload')}
              className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>Upload File</span>
            </button>
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto">
          {activePage === 'dashboard' && (
            <DashboardView
              data={dashboardData}
              loading={dataLoading}
              onNavigate={setActivePage}
            />
          )}

          {activePage === 'upload' && (
            <UploadView
              storageMode={storageMode}
              onUploaded={() => {
                refreshWorkspace();
              }}
              onGoToFiles={() => setActivePage('files')}
            />
          )}

          {activePage === 'files' && (
            <FilesView
              files={files}
              loading={dataLoading}
              onRefresh={refreshWorkspace}
              onGoToUpload={() => setActivePage('upload')}
              onVerified={(res) => {
                setLatestVerification(res);
              }}
            />
          )}

          {activePage === 'search' && <SearchView />}

          {activePage === 'sort' && <SortView />}

          {activePage === 'verification' && (
            <VerificationView
              files={files}
              latestResult={latestVerification}
              onResult={(res) => setLatestVerification(res)}
              onRefreshFiles={refreshWorkspace}
            />
          )}

          {activePage === 'logs' && <LogsView />}

          {activePage === 'profile' && <ProfileView user={user} />}
        </main>
      </div>
    </div>
  );
}
