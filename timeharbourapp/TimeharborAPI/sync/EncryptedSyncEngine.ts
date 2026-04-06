/**
 * EncryptedSyncEngine — pushes / pulls encrypted op-log batches
 * through the server, which only ever sees opaque blobs.
 *
 * Flow:
 *   PUSH:  local opLog (unsynced) → encrypt → POST /sync/oplog
 *   PULL:  GET /sync/oplog?since= → decrypt → OpLogApplicator
 */

import { db } from '../db';
import { getApiUrl } from '../apiUrl';
import { encrypt, decrypt } from './CryptoService';
import { getDeviceId } from './KeyManager';
import { compare } from './HLC';
import { applyRemoteOps } from './OpLogApplicator';
import type { OpLogEntry, EncryptedPayload } from './types';

// ── Shared fetch helper (same pattern as existing SyncEngine) ───

async function apiRequest(path: string, options: RequestInit = {}) {
  const base = getApiUrl().replace(/\/api\/?$/, '');
  const url = `${base}/api/timeharbor${path}`;
  const res = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-App-Id': 'timeharbor',
      ...options.headers,
    },
  });
  if (!res.ok) {
    throw new Error(`EncryptedSyncEngine: ${res.status} ${res.statusText} — ${path}`);
  }
  return res.json();
}

// ── Constants ───────────────────────────────────────────────

/** Maximum number of op-log entries per encrypted batch. */
const BATCH_SIZE = 50;

/** syncMeta key for tracking the last-received HLC cursor. */
const OPLOG_CURSOR_KEY = 'encrypted-oplog';

// ── Push ────────────────────────────────────────────────────

/**
 * Push all unsynced op-log entries to the server as encrypted batches.
 *
 * @param syncKey  The AES-256-GCM CryptoKey used for encryption.
 * @returns Number of entries pushed.
 */
export async function pushOpLog(syncKey: CryptoKey): Promise<number> {
  const deviceId = getDeviceId();
  console.log('[sync:push] starting push, deviceId:', deviceId);
  let totalPushed = 0;

  // Process in batches to avoid huge payloads
  while (true) {
    const entries = await db.opLog
      .where({ userId: (await currentUserId()), _synced: 0, _syncEnabled: 1 })
      .limit(BATCH_SIZE)
      .sortBy('hlc');

    if (entries.length === 0) break;

    const plaintext = JSON.stringify(entries);
    const payload: EncryptedPayload = await encrypt(plaintext, syncKey);
    const lastHLC = entries[entries.length - 1].hlc;

    await apiRequest('/sync/oplog', {
      method: 'POST',
      body: JSON.stringify({
        deviceId,
        lastHLC,
        count: entries.length,
        payload,
      }),
    });

    // Mark as synced
    const ids = entries.map((e) => e.id);
    await db.opLog
      .where('id')
      .anyOf(ids)
      .modify({ _synced: 1 });

    totalPushed += entries.length;
    console.log('[sync:push] pushed batch:', entries.length, 'entries, total:', totalPushed);

    // If this batch was smaller than BATCH_SIZE, we're done
    if (entries.length < BATCH_SIZE) break;
  }

  console.log('[sync:push] done, total pushed:', totalPushed);
  return totalPushed;
}

// ── Pull ────────────────────────────────────────────────────

/**
 * Pull encrypted op-log batches from the server (from other devices)
 * and apply them to the local Dexie database.
 *
 * @param syncKey  The AES-256-GCM CryptoKey used for decryption.
 * @returns Number of entries applied.
 */
export async function pullOpLog(syncKey: CryptoKey): Promise<number> {
  const deviceId = getDeviceId();
  const cursor = await getOpLogCursor();
  console.log('[sync:pull] starting pull, deviceId:', deviceId, 'cursor:', cursor);
  const params = new URLSearchParams({ deviceId });
  if (cursor) params.set('since', cursor);

  const { batches, serverTime } = await apiRequest(
    `/sync/oplog?${params.toString()}`,
  ) as {
    batches: Array<{
      deviceId: string;
      lastHLC: string;
      count: number;
      payload: EncryptedPayload;
    }>;
    serverTime: string;
  };

  console.log('[sync:pull] received', batches.length, 'batch(es) from server');
  let totalApplied = 0;

  for (const batch of batches) {
    try {
      console.log('[sync:pull] decrypting batch from', batch.deviceId, '—', batch.count, 'entries');
      const plaintext = await decrypt(batch.payload, syncKey);
      const entries: OpLogEntry[] = JSON.parse(plaintext);
      console.log('[sync:pull] decrypted OK, applying', entries.length, 'ops');

      await applyRemoteOps(entries);
      totalApplied += entries.length;
    } catch (err: any) {
      // OperationError = wrong key (batch was encrypted with a different passphrase).
      // Skip it and keep processing remaining batches.
      if (err?.name === 'OperationError') {
        console.warn('[sync:pull] skipping batch from', batch.deviceId, '— encrypted with a different key');
        continue;
      }
      console.error('[sync:pull] error processing batch:', err);
      throw err;
    }
  }

  // Update cursor to the latest HLC we received
  if (batches.length > 0) {
    const allHLCs = batches.map((b) => b.lastHLC);
    allHLCs.sort(compare);
    const latestHLC = allHLCs[allHLCs.length - 1];
    await setOpLogCursor(latestHLC);
  }

  return totalApplied;
}

// ── Full sync cycle ─────────────────────────────────────────

/**
 * Execute a complete encrypted sync cycle:  push → pull.
 *
 * @param syncKey  The AES-256-GCM CryptoKey.
 * @returns Summary of pushed and pulled counts.
 */
export async function syncAll(
  syncKey: CryptoKey,
): Promise<{ pushed: number; pulled: number }> {
  console.log('[sync] ── sync cycle starting ──');
  const pushed = await pushOpLog(syncKey);
  const pulled = await pullOpLog(syncKey);
  console.log('[sync] ── sync cycle done ── pushed:', pushed, 'pulled:', pulled);
  return { pushed, pulled };
}

// ── Compaction ──────────────────────────────────────────────

/**
 * Ask the server to delete old encrypted batches that all devices
 * have already consumed.  Call periodically to reclaim storage.
 */
export async function compactOpLog(): Promise<{ deleted: number }> {
  const deviceId = getDeviceId();
  const cursor = await getOpLogCursor();
  if (!cursor) return { deleted: 0 };

  return apiRequest('/sync/oplog/compact', {
    method: 'DELETE',
    body: JSON.stringify({ deviceId, beforeHLC: cursor }),
  });
}

// ── Helpers ─────────────────────────────────────────────────

async function getOpLogCursor(): Promise<string | null> {
  const meta = await db.syncMeta.get(OPLOG_CURSOR_KEY);
  return meta?.lastPulledAt ?? null;
}

async function setOpLogCursor(hlc: string): Promise<void> {
  await db.syncMeta.put({ collection: OPLOG_CURSOR_KEY, lastPulledAt: hlc });
}

async function currentUserId(): Promise<string> {
  // Reuse the existing auth helper already used by the legacy SyncEngine
  const { getStoredUser } = await import('../auth');
  const user = await getStoredUser();
  return user?.id ?? 'anonymous';
}
