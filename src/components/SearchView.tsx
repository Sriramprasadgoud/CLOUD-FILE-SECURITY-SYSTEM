import React, { useState } from 'react';
import { Search, Download, ShieldCheck } from 'lucide-react';
import { api } from '../api';
import type { FileRecord, SearchMetrics } from '../types';
import { formatBytes, formatTimestamp, truncateHash } from '../utils/format';

export function SearchView() {
  const [algorithm, setAlgorithm] = useState<'linear' | 'binary'>('linear');
  const [field, setField] = useState<'filename' | 'extension' | 'file_type'>('filename');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<FileRecord[] | null>(null);
  const [metrics, setMetrics] = useState<SearchMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await api.searchFiles(
        algorithm,
        query,
        algorithm === 'binary' ? 'filename' : field,
      );
      setResults(res.results);
      setMetrics(res.metrics);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="pb-5 border-b border-slate-800/80">
        <h1 className="text-2xl font-semibold text-white tracking-tight">Search Files</h1>
        <p className="mt-1 text-sm text-slate-400">
          Execute from-scratch Linear Search or Binary Search over your encrypted file metadata.
        </p>
      </div>

      {/* Controls */}
      <form
        onSubmit={handleSearch}
        className="p-5 rounded-xl bg-[#0D1628] border border-slate-800/80 space-y-4"
      >
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-[#070D1A] border border-slate-800">
            <button
              type="button"
              onClick={() => setAlgorithm('linear')}
              className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                algorithm === 'linear'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Linear Search · O(n)
            </button>
            <button
              type="button"
              onClick={() => {
                setAlgorithm('binary');
                setField('filename');
              }}
              className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                algorithm === 'binary'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Binary Search · O(log n)
            </button>
          </div>

          {algorithm === 'linear' && (
            <select
              value={field}
              onChange={(e) => setField(e.target.value as typeof field)}
              aria-label="Search target field"
              className="px-3 py-2 rounded-lg bg-[#070D1A] border border-slate-800 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="filename">By Filename</option>
              <option value="extension">By Extension (e.g. pdf, txt)</option>
              <option value="file_type">By MIME File Type</option>
            </select>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                algorithm === 'binary'
                  ? 'Enter exact filename or prefix (sorted alphabetically first)…'
                  : field === 'extension'
                    ? 'Enter file extension (e.g. pdf, csv, png)…'
                    : field === 'file_type'
                      ? 'Enter MIME type fragment (e.g. application/pdf, text)…'
                      : 'Enter filename substring…'
              }
              className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[#070D1A] border border-slate-800 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium transition-colors whitespace-nowrap"
          >
            {loading ? 'Searching…' : 'Run Search Algorithm'}
          </button>
        </div>

        <p className="text-xs text-slate-400">
          {algorithm === 'linear'
            ? 'Linear Search scans each record sequentially without requiring pre-sorted metadata. Worst-case time complexity: O(n).'
            : 'Binary Search sorts file metadata alphabetically with Merge Sort O(n log n), then halves the search space on each probe in O(log n) time.'}
        </p>
      </form>

      {error && (
        <div className="p-4 rounded-xl bg-red-950/50 border border-red-800/70 text-red-200 text-sm">
          {error}
        </div>
      )}

      {/* Algorithm Execution Telemetry & Trace */}
      {metrics && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 p-5 rounded-xl bg-[#0D1628] border border-slate-800/80 space-y-3">
            <h2 className="text-sm font-semibold text-white">Algorithm Analysis</h2>
            <dl className="space-y-2 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                <dt className="text-slate-400">Algorithm</dt>
                <dd className="text-slate-100 font-medium">{metrics.algorithm}</dd>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                <dt className="text-slate-400">Time Complexity</dt>
                <dd className="text-sky-400 font-mono">{metrics.timeComplexity}</dd>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                <dt className="text-slate-400">Records Scanned</dt>
                <dd className="text-slate-100 font-mono tabular-nums">{metrics.totalScanned}</dd>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                <dt className="text-slate-400">Comparisons</dt>
                <dd className="text-slate-100 font-mono tabular-nums">{metrics.comparisons}</dd>
              </div>
              <div className="flex justify-between py-1.5">
                <dt className="text-slate-400">Execution Time</dt>
                <dd className="text-slate-100 font-mono tabular-nums">{metrics.executionTimeMs} ms</dd>
              </div>
            </dl>
          </div>

          <div className="lg:col-span-7 p-5 rounded-xl bg-[#0D1628] border border-slate-800/80 space-y-3">
            <h2 className="text-sm font-semibold text-white">Execution Trace</h2>
            <ul className="space-y-1.5 font-mono text-xs text-slate-300 max-h-44 overflow-y-auto">
              {metrics.steps.map((step, idx) => (
                <li key={idx} className="py-1 border-b border-slate-800/40 last:border-0">
                  {step}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Results Table */}
      {results !== null && (
        <div className="rounded-xl bg-[#0D1628] border border-slate-800/80 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800/80 flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">
              Matching Records ({results.length})
            </h2>
          </div>

          {results.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">
              No encrypted files matched your query.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800/80 text-xs text-slate-400">
                    <th className="py-3 px-5 font-medium">File Name</th>
                    <th className="py-3 px-4 font-medium">MIME Type</th>
                    <th className="py-3 px-4 font-medium text-right">Size</th>
                    <th className="py-3 px-4 font-medium">SHA-256</th>
                    <th className="py-3 px-4 font-medium">Upload Date</th>
                    <th className="py-3 px-5 font-medium text-right">Download</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-sm">
                  {results.map((file) => (
                    <tr key={file.id} className="hover:bg-slate-800/30">
                      <td className="py-3 px-5 font-medium text-slate-100">
                        {file.original_filename}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-400">{file.file_type}</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-xs text-slate-300">
                        {formatBytes(file.file_size)}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-400">
                        {truncateHash(file.sha256_hash, 8, 6)}
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums text-xs text-slate-400">
                        {formatTimestamp(file.upload_date)}
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
