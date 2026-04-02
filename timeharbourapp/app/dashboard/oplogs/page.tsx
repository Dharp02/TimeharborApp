'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@mieweb/ui';
import { Loader2, CheckCircle2, XCircle, RefreshCw, Trash2 } from 'lucide-react';
import { db, type DexieOperationLog } from '@/TimeharborAPI/db';
import { getApiUrl } from '@/TimeharborAPI/apiUrl';

const CATEGORY_COLORS: Record<string, string> = {
  SESSION: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  TICKET: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  PROJECT: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  AUTH: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  NOTIFICATION: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  NOTE: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
  PROFILE: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
  SYNC: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
};

export default function OpLogsPage() {
  const [logs, setLogs] = useState<DexieOperationLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isClearing, setIsClearing] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [filterResult, setFilterResult] = useState<string>('ALL');
  const [visibleCount, setVisibleCount] = useState(50);

  const categories = ['ALL', 'SESSION', 'TICKET', 'PROJECT', 'AUTH', 'NOTIFICATION', 'NOTE', 'PROFILE', 'SYNC'];

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const allLogs = await db.operationLogs
        .orderBy('timestamp')
        .reverse()
        .toArray();
      setLogs(allLogs);
    } catch (error) {
      console.error('Failed to fetch operation logs:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleClear = async () => {
    if (!window.confirm('Clear all operation logs? This will remove logs from this device and the server.')) return;
    setIsClearing(true);
    try {
      // Clear IndexedDB
      await db.operationLogs.clear();

      // Clear MongoDB via backend
      const base = getApiUrl().replace(/\/api\/?$/, '');
      await fetch(`${base}/api/timeharbor/sync/operations/clear`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-App-Id': 'timeharbor' },
      });

      setLogs([]);
    } catch (error) {
      console.error('Failed to clear operation logs:', error);
      alert('Failed to clear logs. Please try again.');
    } finally {
      setIsClearing(false);
    }
  };

  const filtered = logs.filter((log) => {
    if (filterCategory !== 'ALL' && log.category !== filterCategory) return false;
    if (filterResult !== 'ALL' && log.result !== filterResult) return false;
    return true;
  });

  const visible = filtered.slice(0, visibleCount);

  const formatTimestamp = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Operation Logs</h1>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={handleClear} disabled={isClearing || logs.length === 0} aria-label="Clear all operation logs">
              {isClearing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            </Button>
            <Button variant="outline" size="icon" onClick={fetchLogs} aria-label="Refresh operation logs">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {filtered.length} operation{filtered.length !== 1 ? 's' : ''} recorded
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          aria-label="Filter by category"
        >
          {categories.map((c) => (
            <option key={c} value={c}>{c === 'ALL' ? 'All Categories' : c}</option>
          ))}
        </select>
        <select
          value={filterResult}
          onChange={(e) => setFilterResult(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          aria-label="Filter by result"
        >
          <option value="ALL">All Results</option>
          <option value="success">Success</option>
          <option value="failure">Failure</option>
        </select>
      </div>

      {/* Logs table */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : visible.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No operation logs found.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm" role="table" aria-label="Operation logs">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Time</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Category</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Action</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Result</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Target</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Details</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((log) => (
                  <tr key={log.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                      {formatTimestamp(log.timestamp)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${CATEGORY_COLORS[log.category] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'}`}>
                        {log.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{log.action}</td>
                    <td className="px-4 py-3">
                      {log.result === 'success' ? (
                        <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span className="text-xs">OK</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400">
                          <XCircle className="w-3.5 h-3.5" />
                          <span className="text-xs">FAIL</span>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {log.target && <span>{log.target}</span>}
                      {log.targetId && (
                        <span className="text-muted-foreground ml-1" title={log.targetId}>
                          ({log.targetId.slice(0, 8)})
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs max-w-50 truncate text-muted-foreground" title={log.errorMessage || (log.details ? JSON.stringify(log.details) : '')}>
                      {log.errorMessage ? (
                        <span className="text-red-500">{log.errorMessage}</span>
                      ) : log.details ? (
                        JSON.stringify(log.details)
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {visibleCount < filtered.length && (
            <div className="flex justify-center">
              <Button variant="outline" size="sm" onClick={() => setVisibleCount((c) => c + 50)}>
                Show more ({filtered.length - visibleCount} remaining)
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
