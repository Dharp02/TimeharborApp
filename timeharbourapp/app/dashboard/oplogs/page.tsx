'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@mieweb/ui';
import { Loader2, CheckCircle2, XCircle, RefreshCw, Trash2, Upload, Square, CheckSquare } from 'lucide-react';
import { db, type DexieOperationLog } from '@/TimeharborAPI/db';
import { getApiUrl } from '@/TimeharborAPI/apiUrl';
import { syncManager } from '@/TimeharborAPI/SyncManager';
import type { OpLogEntry } from '@/TimeharborAPI/sync/types';

const COLLECTION_COLORS: Record<string, string> = {
  workSessions: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  tickets: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  projects: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  notes: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
  activityLogs: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
};

const OP_COLORS: Record<string, string> = {
  CREATE: 'text-green-600 dark:text-green-400',
  UPDATE: 'text-blue-600 dark:text-blue-400',
  DELETE: 'text-red-600 dark:text-red-400',
};

// ── Sync Queue Tab ──────────────────────────────────────────

function SyncQueueTab() {
  const [entries, setEntries] = useState<OpLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  const fetchEntries = useCallback(async () => {
    setIsLoading(true);
    try {
      const all = await db.opLog.orderBy('hlc').reverse().toArray();
      setEntries(all);
    } catch (error) {
      console.error('Failed to fetch op-log entries:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  // ── Selection helpers ──

  const toggleEntry = async (id: string, current: 0 | 1) => {
    const next: 0 | 1 = current === 1 ? 0 : 1;
    await db.opLog.update(id, { _syncEnabled: next });
    setEntries((prev) => prev.map((e) => e.id === id ? { ...e, _syncEnabled: next } : e));
  };

  const selectAll = async () => {
    const ids = entries.filter((e) => e._synced === 0 && e._syncEnabled === 0).map((e) => e.id);
    if (ids.length === 0) return;
    await db.opLog.where('id').anyOf(ids).modify({ _syncEnabled: 1 });
    setEntries((prev) => prev.map((e) => e._synced === 0 ? { ...e, _syncEnabled: 1 } : e));
  };

  const deselectAll = async () => {
    const ids = entries.filter((e) => e._synced === 0 && e._syncEnabled === 1).map((e) => e.id);
    if (ids.length === 0) return;
    await db.opLog.where('id').anyOf(ids).modify({ _syncEnabled: 0 });
    setEntries((prev) => prev.map((e) => e._synced === 0 ? { ...e, _syncEnabled: 0 } : e));
  };

  const handleSyncSelected = async () => {
    setIsSyncing(true);
    try {
      await syncManager.syncNow();
      await fetchEntries();
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  // ── Derived counts ──

  const pending = entries.filter((e) => e._synced === 0);
  const selectedCount = pending.filter((e) => e._syncEnabled === 1).length;
  const synced = entries.filter((e) => e._synced === 1);
  const allPendingSelected = pending.length > 0 && selectedCount === pending.length;

  const formatTimestamp = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  };

  const describeEntry = (entry: OpLogEntry): string => {
    if (entry.operation === 'CREATE' && entry.snapshot) {
      const name = (entry.snapshot.title ?? entry.snapshot.name ?? entry.snapshot.id ?? '') as string;
      return name ? `Created "${name}"` : 'Created';
    }
    if (entry.operation === 'UPDATE' && entry.patch) {
      const fields = Object.keys(entry.patch).filter((k) => !k.startsWith('_'));
      return `Updated ${fields.join(', ')}`;
    }
    if (entry.operation === 'DELETE') return 'Deleted';
    return '—';
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Toolbar ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-foreground">
            Pending
          </h2>
          <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
            {pending.length}
          </span>
          {selectedCount > 0 && (
            <span className="text-sm text-primary">
              {selectedCount} selected
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {pending.length > 0 && (
            <button
              onClick={allPendingSelected ? deselectAll : selectAll}
              className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
              aria-label={allPendingSelected ? 'Deselect all' : 'Select all'}
            >
              {allPendingSelected ? 'Deselect all' : 'Select all'}
            </button>
          )}
          <Button
            size="sm"
            onClick={handleSyncSelected}
            disabled={isSyncing || selectedCount === 0}
            aria-label="Sync selected entries"
            className="min-w-25"
          >
            {isSyncing
              ? <Loader2 className="w-4 h-4 animate-spin mr-2" />
              : <Upload className="w-4 h-4 mr-2" />}
            Sync{selectedCount > 0 ? ` (${selectedCount})` : ''}
          </Button>
          <Button variant="ghost" size="icon" onClick={fetchEntries} aria-label="Refresh">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* ── Pending cards ── */}
      {pending.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-12 text-center">
          <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">All changes are synced</p>
        </div>
      ) : (
        <div className="space-y-2">
          {pending.map((entry) => (
            <button
              key={entry.id}
              onClick={() => toggleEntry(entry.id, entry._syncEnabled)}
              className={`op-log-card w-full rounded-xl border p-4 text-left transition-all ${
                entry._syncEnabled === 1
                  ? 'border-primary/30 bg-primary/5 shadow-sm dark:bg-primary/10'
                  : 'border-border bg-card hover:border-muted-foreground/20 hover:shadow-sm'
              }`}
              aria-label={`${entry._syncEnabled === 1 ? 'Deselect' : 'Select'}: ${entry.operation} ${entry.collection}`}
            >
              {/* Row 1: Checkbox + Operation + Collection + Time */}
              <div className="flex items-center gap-3">
                {entry._syncEnabled === 1 ? (
                  <CheckSquare className="w-5 h-5 text-primary shrink-0" />
                ) : (
                  <Square className="w-5 h-5 text-muted-foreground/40 shrink-0" />
                )}

                <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-bold tracking-wide ${OP_COLORS[entry.operation] || ''} ${
                  entry.operation === 'CREATE' ? 'bg-green-100 dark:bg-green-900/20' :
                  entry.operation === 'UPDATE' ? 'bg-blue-100 dark:bg-blue-900/20' :
                  'bg-red-100 dark:bg-red-900/20'
                }`}>
                  {entry.operation}
                </span>

                <span className={`inline-block rounded-md px-2 py-1 text-xs font-medium ${COLLECTION_COLORS[entry.collection] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'}`}>
                  {entry.collection}
                </span>

                <span className="ml-auto text-xs text-muted-foreground">
                  {formatTimestamp(entry.timestamp)}
                </span>
              </div>

              {/* Row 2: Description + Entity ID */}
              <div className="mt-2 ml-8 flex items-center gap-2">
                <span className="text-sm text-foreground/80 truncate">
                  {describeEntry(entry)}
                </span>
                <span className="text-xs font-mono text-muted-foreground/60 shrink-0" title={entry.entityId}>
                  {entry.entityId.slice(0, 12)}…
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ── Synced section ── */}
      {synced.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold text-muted-foreground">Synced</h2>
            <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
              {synced.length}
            </span>
          </div>
          <div className="space-y-1.5">
            {synced.slice(0, 20).map((entry) => (
              <div
                key={entry.id}
                className="flex items-center gap-3 rounded-lg border border-border/50 bg-muted/5 px-4 py-3 opacity-50"
              >
                <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />

                <span className={`text-xs font-bold tracking-wide ${OP_COLORS[entry.operation] || ''}`}>
                  {entry.operation}
                </span>

                <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${COLLECTION_COLORS[entry.collection] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'}`}>
                  {entry.collection}
                </span>

                <span className="text-sm text-muted-foreground truncate flex-1">
                  {describeEntry(entry)}
                </span>

                <span className="text-xs text-muted-foreground shrink-0">
                  {formatTimestamp(entry.timestamp)}
                </span>
              </div>
            ))}
            {synced.length > 20 && (
              <p className="text-xs text-muted-foreground text-center pt-2">
                + {synced.length - 20} more
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Operation Logs Tab (existing) ───────────────────────────

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

function OperationLogsTab() {
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {filtered.length} operation{filtered.length !== 1 ? 's' : ''} recorded
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={handleClear} disabled={isClearing || logs.length === 0} aria-label="Clear all operation logs">
            {isClearing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          </Button>
          <Button variant="outline" size="icon" onClick={fetchLogs} aria-label="Refresh operation logs">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
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

// ── Main Page with Tabs ─────────────────────────────────────

type TabKey = 'sync-queue' | 'operation-logs';

export default function OpLogsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('sync-queue');

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'sync-queue', label: 'Sync Queue' },
    { key: 'operation-logs', label: 'Operation Logs' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Sync &amp; Logs</h1>

      {/* Tab bar */}
      <div className="flex border-b border-border" role="tablist" aria-label="Op logs tabs">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'sync-queue' ? <SyncQueueTab /> : <OperationLogsTab />}
    </div>
  );
}
