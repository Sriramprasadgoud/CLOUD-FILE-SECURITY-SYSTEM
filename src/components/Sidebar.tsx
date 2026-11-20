import React from 'react';
import {
  LayoutDashboard,
  UploadCloud,
  FolderLock,
  Search,
  ArrowUpDown,
  ShieldCheck,
  Activity,
  UserCog,
  LogOut,
  X,
} from 'lucide-react';
import type { NavPage, User } from '../types';

interface SidebarProps {
  activePage: NavPage;
  onNavigate: (page: NavPage) => void;
  onLogout: () => void;
  user: User;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const NAV_ITEMS: { id: NavPage; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'upload', label: 'Upload Files', icon: UploadCloud },
  { id: 'files', label: 'My Files', icon: FolderLock },
  { id: 'search', label: 'Search Files', icon: Search },
  { id: 'sort', label: 'Sort Files', icon: ArrowUpDown },
  { id: 'verification', label: 'Security Verification', icon: ShieldCheck },
  { id: 'logs', label: 'Activity Logs', icon: Activity },
  { id: 'profile', label: 'Profile', icon: UserCog },
];

export function Sidebar({
  activePage,
  onNavigate,
  onLogout,
  user,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const handleSelect = (page: NavPage) => {
    onNavigate(page);
    onCloseMobile();
  };

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#0B1325] border-r border-slate-800/80 flex flex-col transition-transform duration-200 lg:static lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-16 px-5 border-b border-slate-800/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <span className="font-semibold text-sm text-white truncate">
              Cloud File Security
            </span>
          </div>
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Close navigation menu"
            className="lg:hidden p-1.5 rounded-md text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" aria-label="Primary navigation">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activePage === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-white' : 'text-slate-400'}`} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-800/80 space-y-2 shrink-0">
          <div className="px-3 py-2 rounded-lg bg-[#070D1A] border border-slate-800/80">
            <p className="text-sm font-medium text-slate-100 truncate">{user.username}</p>
            <p className="text-xs text-slate-400 truncate">{user.email}</p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-red-950/50 hover:text-red-200 transition-colors whitespace-nowrap"
          >
            <LogOut className="w-4 h-4 text-slate-400 shrink-0" />
            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}
