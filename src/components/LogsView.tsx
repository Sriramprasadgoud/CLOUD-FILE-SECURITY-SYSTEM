import React, { useEffect, useState } from 'react';
import { RefreshCw, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { api } from '../api';
import type { ActivityLog } from '../types';
import { formatTimestamp } from '../utils/format';

const ACTION_OPTIONS = [
  { value: '', label: 'All Events' },
  { value: 'USER_LOGIN', label: 'User Login' },
  { value: 'USER_REGISTER', label: 'User Register' },
  { value: 'USER_LOGOUT', label: 'User Logout' },
  { value: 'FILE_UPLOAD', label: 'File Upload' },
  { value: 'FILE_ENCRYPTION', label: 'File Encryption' },
  { value: 'CLOUD_UPLOAD', label: 'Cloud Upload' },
  { value: 'FILE_DOWNLOAD', label: 'File Download' },
  { value: 'FILE_DECRYPTION', label: 'File Decryption' },
  { value: 'INTEGRITY_VERIFICATION', label: 'Integrity Verification' },
  { value: 'FILE_DELETE', label: 'File Deletion' },
];

export function LogsView() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [actionFilter, setActionFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const loadLogs = async (filter: string) => {
    setLoading(true);
    try {
      const res = await api.getLogs(filter);
      setLogs(res.logs);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs(actionFilter);
  }, [actionFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800/80">
        <div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">Activity Audit Logs</h1>
          <p className="mt-1 text-sm text-slate-400">
            Immutable operational audit trail. Passwords, keys, and file contents are never logged.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            aria-label="Filter logs by action"
            className="px-3 py-2 rounded-lg bg-[#0D1628] border border-slate-800 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
          >
            {ACTION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => loadLogs(actionFilter)}
            className="p-2 rounded-lg border border-slate-800 bg-[#0D1628] text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Refresh audit logs"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="rounded-xl bg-[#0D1628] border border-slate-800/80 overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-9 rounded bg-slate-800/50 animate-pulse" />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-400">
            No audit log entries found for the selected filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800/80 text-xs text-slate-400">
                  <th className="py-3.5 px-5 font-medium">Timestamp</th>
                  <th className="py-3.5 px-4 font-medium">Action</th>
                  <th className="py-3.5 px-4 font-medium">Target File</th>
                  <th className="py-3.5 px-5 font-medium text-right">Operation Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-sm">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/30">
                    <td className="py-3 px-5 font-mono tabular-nums text-xs text-slate-400 whitespace-nowrap">
                      {formatTimestamp(log.timestamp)}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-100 whitespace-nowrap">
                      {log.action.replace(/_/g, ' ')}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-300 max-w-[260px] truncate">
                      {log.filename || '—'}
                    </td>
                    <td className="py-3 px-5 text-right whitespace-nowrap">
                      {log.status === 'SUCCESS' ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          SUCCESS
                        </span>
                      ) : log.status === 'WARNING' ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-400">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          WARNING
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-400">
                          <XCircle className="w-3.5 h-3.5" />
                          FAILED
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
    </div>
  );
}
