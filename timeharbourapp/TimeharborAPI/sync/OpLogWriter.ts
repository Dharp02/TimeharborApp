/**
 * OpLogWriter — records every data mutation as an op-log entry.
 *
 * Instead of setting `_dirty = 1` on each entity, the writer appends
 * a structured OpLogEntry to the `opLog` Dexie table.  The encrypted
 * sync engine later reads unsynced entries, encrypts them, and pushes
 * them to the server.
 *
 * Usage:
 *   import { opLogWriter } from '@/TimeharborAPI/sync/OpLogWriter';
 *
 *   // After creating a ticket in Dexie:
 *   await opLogWriter.recordCreate('tickets', ticket.id, ticket);
 *
 *   // After updating fields:
 *   await opLogWriter.recordUpdate('tickets', ticket.id, { title: 'New' });
 *
 *   // After deleting:
 *   await opLogWriter.recordDelete('tickets', ticket.id);
 */

import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import { HLC, pack } from './HLC';
import { getDeviceId } from './KeyManager';
import { getIdentityUUID } from './IdentityManager';
import type { OpLogEntry, SyncCollection } from './types';

// ── Singleton HLC clock ─────────────────────────────────────

let hlcInstance: HLC | null = null;

function getHLC(): HLC {
  if (!hlcInstance) {
    hlcInstance = new HLC(getDeviceId());
  }
  return hlcInstance;
}

/** Reset the HLC (useful for tests or sign-out). */
export function resetHLC(): void {
  hlcInstance = null;
}

// ── Debounced sync trigger ──────────────────────────────────

let syncTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * Schedule a sync shortly after an op-log write.
 * Debounced to 2 seconds so rapid edits batch into one push.
 */
function scheduleSyncAfterWrite(): void {
  if (typeof window === 'undefined') return;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    // Lazy import to avoid circular dependency
    import('../SyncManager').then(({ syncManager }) => {
      syncManager.syncNow();
    });
  }, 2000);
}

// ── Writer ──────────────────────────────────────────────────

export interface OpLogWriteOptions {
  /** Override auto-sync. Set to false to require manual sync approval (e.g. timehuddle tickets). */
  syncEnabled?: boolean;
}

class OpLogWriter {
  /**
   * Record a CREATE operation (full snapshot of the new entity).
   */
  async recordCreate(
    collection: SyncCollection,
    entityId: string,
    snapshot: Record<string, unknown>,
    options?: OpLogWriteOptions,
  ): Promise<OpLogEntry> {
    return this.write(collection, 'CREATE', entityId, { snapshot }, options);
  }

  /**
   * Record an UPDATE operation (only the changed fields).
   */
  async recordUpdate(
    collection: SyncCollection,
    entityId: string,
    patch: Record<string, unknown>,
    options?: OpLogWriteOptions,
  ): Promise<OpLogEntry> {
    return this.write(collection, 'UPDATE', entityId, { patch }, options);
  }

  /**
   * Record a DELETE operation.
   */
  async recordDelete(
    collection: SyncCollection,
    entityId: string,
    options?: OpLogWriteOptions,
  ): Promise<OpLogEntry> {
    return this.write(collection, 'DELETE', entityId, {}, options);
  }

  // ── Internal ────────────────────────────────────────────

  private async write(
    collection: SyncCollection,
    operation: OpLogEntry['operation'],
    entityId: string,
    data: { snapshot?: Record<string, unknown>; patch?: Record<string, unknown> },
    options?: OpLogWriteOptions,
  ): Promise<OpLogEntry> {
    const userId = getIdentityUUID();
    const hlc = getHLC();
    const ts = hlc.now();

    const entry: OpLogEntry = {
      id: uuidv4(),
      deviceId: getDeviceId(),
      userId,
      timestamp: new Date(ts.physical).toISOString(),
      hlc: pack(ts),
      collection,
      operation,
      entityId,
      ...(data.snapshot ? { snapshot: data.snapshot } : {}),
      ...(data.patch ? { patch: data.patch } : {}),
      _synced: 0,
      _syncEnabled: options?.syncEnabled === false ? 0 : 1,
    };

    await db.opLog.add(entry);

    // Trigger a sync shortly after write so data reaches the server quickly
    if (entry._syncEnabled) {
      scheduleSyncAfterWrite();
    }

    return entry;
  }
}

export const opLogWriter = new OpLogWriter();
