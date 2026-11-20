import React, { useState } from 'react';
import { ArrowUpDown, Download } from 'lucide-react';
import { api } from '../api';
import type { FileRecord, SortMetrics } from '../types';
import { formatBytes, formatTimestamp, truncateHash } from '../utils/format';

export function SortView() {
  const [algorithm, setAlgorithm] = useState<'merge' | 'quick'>('merge');
  const [sortBy, setSortBy] = useState<'filename' | 'upload_date' | 'file_size'>('filename');
  const [order, setOrder] = useState<'asc' | 'desc'>('asc');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<FileRecord[] | null>(null);
  const [metrics, setMetrics] = useState<SortMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSort = async () => {
    setLoading(true);
    setError(null);
    try {
      const targetField =
        algorithm === 'quick' && sortBy === 'upload_date' ? 'file_size' : sortBy;
      const res = await api.sortFiles(algorithm, targetField, order);
      setResults(res.results);
      setMetrics(res.metrics);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sort operation failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="pb-5 border-b border-slate-800/80">
        <h1 className="text-2xl font-semibold text-white tracking-tight">Sort Files</h1>
        <p className="mt-1 text-sm text-slate-400">
          Organize encrypted file metadata with custom Merge Sort and Quick Sort implementations.
        </p>
      </div>

      <div className="p-5 rounded-xl bg-[#0D1628] border border-slate-800/80 space-y-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-[#070D1A] border border-slate-800">
            <button
              type="button"
              onClick={() => setAlgorithm('merge')}
              className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                algorithm === 'merge'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Merge Sort · O(n log n)
            </button>
            <button
              type="button"
              onClick={() => {
                setAlgorithm('quick');
                if (sortBy === 'upload_date') setSortBy('file_size');
              }}
              className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                algorithm === 'quick'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Quick Sort · In-Place Partition
            </button>
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            aria-label="Sort field"
            className="px-3 py-2 rounded-lg bg-[#070D1A] border border-slate-800 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option value="filename">Sort by Filename (Alphabetical)</option>
            <option value="file_size">Sort by File Size</option>
            {algorithm === 'merge' && (
              <option value="upload_date">Sort by Upload Date</option>
            )}
          </select>

          <div className="flex items-center gap-1 p-1 rounded-lg bg-[#070D1A] border border-slate-800">
            <button
              type="button"
              onClick={() => setOrder('asc')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                order === 'asc'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Ascending
            </button>
            <button
              type="button"
              onClick={() => setOrder('desc')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                order === 'desc'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Descending
            </button>
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={handleSort}
            className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium transition-colors inline-flex items-center gap-2 whitespace-nowrap ml-auto"
          >
            <ArrowUpDown className="w-4 h-4" />
            <span>{loading ? 'Sorting…' : 'Execute Sort'}</span>
          </button>
        </div>

        <p className="text-xs text-slate-400">
          {algorithm === 'merge'
            ? 'Merge Sort uses divide-and-conquer recursive splitting and stable merging, guaranteeing O(n log n) worst-case performance.'
            : 'Quick Sort partitions elements in-place around a median-of-three pivot, achieving O(n log n) average time with O(log n) stack space.'}
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-950/50 border border-red-800/70 text-red-200 text-sm">
          {error}
        </div>
      )}

      {metrics && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="p-4 rounded-xl bg-[#0D1628] border border-slate-800/80">
            <span className="text-xs text-slate-400">Algorithm</span>
            <p className="mt-1 text-sm font-semibold text-white">{metrics.algorithm}</p>
          </div>
          <div className="p-4 rounded-xl bg-[#0D1628] border border-slate-800/80">
            <span className="text-xs text-slate-400">Items Sorted</span>
            <p className="mt-1 text-sm font-mono tabular-nums text-white">{metrics.totalItems}</p>
          </div>
          <div className="p-4 rounded-xl bg-[#0D1628] border border-slate-800/80">
            <span className="text-xs text-slate-400">Comparisons</span>
            <p className="mt-1 text-sm font-mono tabular-nums text-sky-400">{metrics.comparisons}</p>
          </div>
          <div className="p-4 rounded-xl bg-[#0D1628] border border-slate-800/80">
            <span className="text-xs text-slate-400">Moves / Swaps</span>
            <p className="mt-1 text-sm font-mono tabular-nums text-white">{metrics.swapsOrMoves}</p>
          </div>
          <div className="p-4 rounded-xl bg-[#0D1628] border border-slate-800/80 col-span-2 lg:col-span-1">
            <span className="text-xs text-slate-400">Runtime</span>
            <p className="mt-1 text-sm font-mono tabular-nums text-white">
              {metrics.executionTimeMs} ms
            </p>
          </div>
        </div>
      )}

      {results !== null && (
        <div className="rounded-xl bg-[#0D1628] border border-slate-800/80 overflow-hidden">
          {results.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">
              Upload files first to run Merge Sort or Quick Sort.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800/80 text-xs text-slate-400">
                    <th className="py-3 px-5 font-medium">#</th>
                    <th className="py-3 px-4 font-medium">File Name</th>
                    <th className="py-3 px-4 font-medium text-right">File Size</th>
                    <th className="py-3 px-4 font-medium">Upload Date</th>
                    <th className="py-3 px-4 font-medium">SHA-256</th>
                    <th className="py-3 px-5 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-sm">
                  {results.map((file, idx) => (
                    <tr key={file.id} className="hover:bg-slate-800/30">
                      <td className="py-3 px-5 font-mono tabular-nums text-xs text-slate-500">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-100">
                        {file.original_filename}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-xs text-slate-300">
                        {formatBytes(file.file_size)}
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums text-xs text-slate-400">
                        {formatTimestamp(file.upload_date)}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-400">
                        {truncateHash(file.sha256_hash, 8, 6)}
                      </td>
                      <td className="py-3 px-5 text-right">
                        <button
                          type="button"
                          onClick={() => api.downloadFile(file.id, file.original_filename)}
                          className="px-2.5 py-1.5 rounded-md bg-slate-800 hover:bg-blue-600 text-slate-200 hover:text-white text-xs font-medium inline-flex items-center gap-1 transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
