'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@mieweb/ui';
import { Loader2, CheckCircle2, XCircle, RefreshCw, Trash2, Upload, Square, CheckSquare, ShieldCheck, Wifi, Database, Key } from 'lucide-react';
import { db, type DexieOperationLog } from '@/TimeharborAPI/db';
import { getApiUrl } from '@/TimeharborAPI/apiUrl';
import { syncManager } from '@/TimeharborAPI/SyncManager';
import type { OpLogEntry } from '@/TimeharborAPI/sync/types';
import { encrypt, decrypt, deriveMasterKey, deriveSyncKey, derivePassphraseSalt } from '@/TimeharborAPI/sync/CryptoService';
import { isEncryptionSetUp, getDeviceId } from '@/TimeharborAPI/sync/KeyManager';
import { pushOpLog, pullOpLog } from '@/TimeharborAPI/sync/EncryptedSyncEngine';
import { HLC } from '@/TimeharborAPI/sync/HLC';

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

// ── Diagnostics Tab ─────────────────────────────────────────

type DiagResult = { status: 'idle' | 'running' | 'pass' | 'fail'; detail: string };

function DiagnosticsTab() {
  const [results, setResults] = useState<Record<string, DiagResult>>({
    webCrypto: { status: 'idle', detail: '' },
    encryptDecrypt: { status: 'idle', detail: '' },
    keyDerivation: { status: 'idle', detail: '' },
    encryptionSetup: { status: 'idle', detail: '' },
    apiConnectivity: { status: 'idle', detail: '' },
    syncPull: { status: 'idle', detail: '' },
    opLogCount: { status: 'idle', detail: '' },
    e2eSync: { status: 'idle', detail: '' },
  });
  const [running, setRunning] = useState(false);

  const update = (key: string, val: DiagResult) =>
    setResults((prev) => ({ ...prev, [key]: val }));

  const runAll = useCallback(async () => {
    setRunning(true);

    // 1. WebCrypto availability
    update('webCrypto', { status: 'running', detail: 'Checking…' });
    if (globalThis.crypto?.subtle) {
      update('webCrypto', { status: 'pass', detail: 'crypto.subtle is available (secure context)' });
    } else {
      update('webCrypto', { status: 'fail', detail: 'crypto.subtle is undefined — not a secure context' });
      setRunning(false);
      return;
    }

    // 2. Encrypt/Decrypt round-trip
    update('encryptDecrypt', { status: 'running', detail: 'Testing AES-256-GCM…' });
    try {
      const testKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
      const testData = 'Hello TimeHarbor! 🚀';
      const encrypted = await encrypt(testData, testKey);
      const decrypted = await decrypt(encrypted, testKey);
      if (decrypted === testData) {
        update('encryptDecrypt', { status: 'pass', detail: `Round-trip OK: "${decrypted}"` });
      } else {
        update('encryptDecrypt', { status: 'fail', detail: `Mismatch: expected "${testData}", got "${decrypted}"` });
      }
    } catch (err: any) {
      update('encryptDecrypt', { status: 'fail', detail: err.message });
    }

    // 3. Key derivation (deterministic salt)
    update('keyDerivation', { status: 'running', detail: 'Testing PBKDF2 + HKDF…' });
    try {
      const testPass = 'test-passphrase-12345';
      const salt = await derivePassphraseSalt(testPass);
      const mk1 = await deriveMasterKey(testPass, salt);
      const sk1 = await deriveSyncKey(mk1);
      const mk2 = await deriveMasterKey(testPass, salt);
      const sk2 = await deriveSyncKey(mk2);
      const enc = await encrypt('cross-key test', sk1);
      const dec = await decrypt(enc, sk2);
      if (dec === 'cross-key test') {
        update('keyDerivation', { status: 'pass', detail: 'Same passphrase → same key (deterministic salt works)' });
      } else {
        update('keyDerivation', { status: 'fail', detail: 'Keys differ — deterministic salt broken' });
      }
    } catch (err: any) {
      update('keyDerivation', { status: 'fail', detail: err.message });
    }

    // 4. Encryption setup status
    update('encryptionSetup', { status: 'running', detail: 'Checking device keys…' });
    try {
      const isSetUp = await isEncryptionSetUp();
      update('encryptionSetup', {
        status: isSetUp ? 'pass' : 'fail',
        detail: isSetUp ? 'Device keys found in IndexedDB' : 'No device keys — encryption not set up',
      });
    } catch (err: any) {
      update('encryptionSetup', { status: 'fail', detail: err.message });
    }

    // 5. API connectivity
    update('apiConnectivity', { status: 'running', detail: 'Calling backend…' });
    try {
      const base = getApiUrl().replace(/\/api\/?$/, '');
      const url = `${base}/api/auth/get-session`;
      const res = await fetch(url, { credentials: 'include', headers: { 'X-App-Id': 'timeharbor' } });
      update('apiConnectivity', {
        status: res.ok ? 'pass' : 'fail',
        detail: `${res.status} ${res.statusText} — ${url}`,
      });
    } catch (err: any) {
      update('apiConnectivity', { status: 'fail', detail: `Fetch failed: ${err.message}` });
    }

    // 6. Sync pull test
    update('syncPull', { status: 'running', detail: 'Pulling from server…' });
    try {
      const base = getApiUrl().replace(/\/api\/?$/, '');
      const res = await fetch(`${base}/api/timeharbor/sync/oplog?deviceId=diag-test`, {
        credentials: 'include',
        headers: { 'X-App-Id': 'timeharbor' },
      });
      if (res.ok) {
        const data = await res.json();
        const count = data.batches?.length ?? 0;
        update('syncPull', { status: 'pass', detail: `${count} batch(es) on server` });
      } else {
        update('syncPull', { status: 'fail', detail: `${res.status} ${res.statusText}` });
      }
    } catch (err: any) {
      update('syncPull', { status: 'fail', detail: `Fetch failed: ${err.message}` });
    }

    // 7. Local op-log count
    update('opLogCount', { status: 'running', detail: 'Counting…' });
    try {
      const total = await db.opLog.count();
      const allEntries = await db.opLog.toArray();
      const unsynced = allEntries.filter((e) => e._synced === 0).length;
      update('opLogCount', { status: 'pass', detail: `${total} total, ${unsynced} unsynced` });
    } catch (err: any) {
      update('opLogCount', { status: 'fail', detail: err.message });
    }

    // 8. End-to-end: create → encrypt → push to MongoDB → pull → decrypt → verify
    update('e2eSync', { status: 'running', detail: 'Creating test entry…' });
    try {
      const sk = syncManager.getSyncKey();
      if (!sk) {
        update('e2eSync', { status: 'fail', detail: 'No sync key loaded — unlock encryption first' });
        setRunning(false);
        return;
      }

      const { getStoredUser } = await import('@/TimeharborAPI/auth');
      const user = await getStoredUser();
      if (!user) {
        update('e2eSync', { status: 'fail', detail: 'Not logged in' });
        setRunning(false);
        return;
      }

      const deviceId = getDeviceId();
      const hlc = new HLC(deviceId);
      const testId = `diag-e2e-${Date.now()}`;
      const testPayload = `e2e-test-${Math.random().toString(36).slice(2, 8)}`;

      // Insert a test op-log entry into Dexie (unsynced)
      const entry: OpLogEntry = {
        id: testId,
        deviceId,
        userId: user.id,
        timestamp: new Date().toISOString(),
        hlc: hlc.tick(),
        collection: 'notes',
        operation: 'CREATE',
        entityId: testId,
        snapshot: { _diagTest: true, payload: testPayload },
        _synced: 0,
        _syncEnabled: 1,
      };
      await db.opLog.put(entry);
      update('e2eSync', { status: 'running', detail: 'Pushing encrypted batch to MongoDB…' });

      // Push to server (encrypts & POSTs)
      const pushed = await pushOpLog(sk);
      if (pushed === 0) {
        update('e2eSync', { status: 'fail', detail: 'pushOpLog returned 0 — entry was not pushed' });
        await db.opLog.delete(testId);
        setRunning(false);
        return;
      }

      update('e2eSync', { status: 'running', detail: `Pushed ${pushed} entry. Pulling back from server…` });

      // Pull from server on a different "device" to get the batch we just pushed
      const base = getApiUrl().replace(/\/api\/?$/, '');
      const pullRes = await fetch(`${base}/api/timeharbor/sync/oplog?deviceId=diag-verify-${Date.now()}`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-App-Id': 'timeharbor' },
      });

      if (!pullRes.ok) {
        update('e2eSync', { status: 'fail', detail: `Pull failed: ${pullRes.status} ${pullRes.statusText}` });
        await db.opLog.delete(testId);
        setRunning(false);
        return;
      }

      const pullData = await pullRes.json();
      const batches = pullData.batches || [];
      update('e2eSync', { status: 'running', detail: `Got ${batches.length} batch(es). Decrypting…` });

      // Find our test entry in the decrypted batches
      let found = false;
      for (const batch of batches) {
        try {
          const plaintext = await decrypt(batch.payload, sk);
          const ops: OpLogEntry[] = JSON.parse(plaintext);
          const match = ops.find((o) => o.id === testId);
          if (match) {
            if ((match.snapshot as any)?.payload === testPayload) {
              found = true;
              update('e2eSync', {
                status: 'pass',
                detail: `E2E OK: created → encrypted → MongoDB → pulled → decrypted. Payload: "${testPayload}"`,
              });
            } else {
              update('e2eSync', {
                status: 'fail',
                detail: `Payload mismatch: expected "${testPayload}", got "${(match.snapshot as any)?.payload}"`,
              });
            }
            break;
          }
        } catch {
          // Skip batches from different keys
          continue;
        }
      }

      if (!found && results.e2eSync?.status !== 'fail') {
        update('e2eSync', {
          status: 'fail',
          detail: `Test entry "${testId}" not found in ${batches.length} batch(es) from server`,
        });
      }

      // Clean up test entry from Dexie
      await db.opLog.delete(testId);
    } catch (err: any) {
      update('e2eSync', { status: 'fail', detail: err.message });
    }

    setRunning(false);
  }, []);

  const statusIcon = (s: DiagResult['status']) => {
    switch (s) {
      case 'pass': return <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />;
      case 'fail': return <XCircle className="w-5 h-5 text-red-500 shrink-0" />;
      case 'running': return <Loader2 className="w-5 h-5 text-blue-500 shrink-0 animate-spin" />;
      default: return <div className="w-5 h-5 rounded-full border-2 border-muted shrink-0" />;
    }
  };

  const labels: Record<string, { icon: typeof Key; label: string }> = {
    webCrypto: { icon: ShieldCheck, label: 'WebCrypto (crypto.subtle)' },
    encryptDecrypt: { icon: Key, label: 'AES-256-GCM Encrypt/Decrypt' },
    keyDerivation: { icon: Key, label: 'Deterministic Key Derivation' },
    encryptionSetup: { icon: Database, label: 'Device Key Storage' },
    apiConnectivity: { icon: Wifi, label: 'API Connectivity' },
    syncPull: { icon: Database, label: 'Server Sync Pull' },
    opLogCount: { icon: Database, label: 'Local Op-Log' },
    e2eSync: { icon: ShieldCheck, label: 'E2E: Encrypt → MongoDB → Decrypt' },
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Test encryption, key derivation, and sync connectivity.
        </p>
        <Button onClick={runAll} disabled={running} variant="primary" size="sm">
          {running ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
          Run Diagnostics
        </Button>
      </div>

      <div className="space-y-2">
        {Object.entries(results).map(([key, val]) => {
          const meta = labels[key] || { icon: Key, label: key };
          const Icon = meta.icon;
          return (
            <div
              key={key}
              className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${
                val.status === 'fail' ? 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/20' :
                val.status === 'pass' ? 'border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/20' :
                'border-border bg-card'
              }`}
            >
              {statusIcon(val.status)}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{meta.label}</span>
                </div>
                {val.detail && (
                  <p className="text-xs text-muted-foreground mt-1 break-all">{val.detail}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Page with Tabs ─────────────────────────────────────

type TabKey = 'sync-queue' | 'operation-logs' | 'diagnostics';

export default function OpLogsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('sync-queue');

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'sync-queue', label: 'Sync Queue' },
    { key: 'operation-logs', label: 'Operation Logs' },
    { key: 'diagnostics', label: 'Diagnostics' },
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
      {activeTab === 'sync-queue' && <SyncQueueTab />}
      {activeTab === 'operation-logs' && <OperationLogsTab />}
      {activeTab === 'diagnostics' && <DiagnosticsTab />}
    </div>
  );
}
