/**
 * MigrationService — one-time migration from legacy dirty-flag sync
 * to the encrypted op-log system.
 *
 * Run once per device on first launch after the update.
 *
 * Steps:
 *   1. For every existing entity in each synced table, generate a CREATE op-log entry.
 *   2. Add `_fieldHLC` to every entity so the per-field LWW system works going forward.
 *   3. Strip legacy sync fields (_dirty, _serverId, _rev) from all records.
 *   4. Mark `migrationVersion = 2` in syncMeta so it never runs again.
 *
 * Note: Legacy sync pull was removed — the 30-day migration window has passed.
 */

import { db } from '../db';
import { HLC, pack } from './HLC';
import { getDeviceId } from './KeyManager';
import { getIdentityUUID } from './IdentityManager';
import type { OpLogEntry, SyncCollection } from './types';
import { v4 as uuidv4 } from 'uuid';
import type { FieldHLCMap } from './types';
import type { Table } from 'dexie';

const MIGRATION_KEY = 'migration-version';
const TARGET_VERSION = '2';

/**
 * Check if this device has already completed the migration.
 */
export async function isMigrated(): Promise<boolean> {
  const meta = await db.syncMeta.get(MIGRATION_KEY);
  return meta?.lastPulledAt === TARGET_VERSION;
}

/**
 * Execute the full migration.
 *
 * @param onProgress  Optional callback for UI progress reporting.
 *                    Receives (step, totalSteps, description).
 */
export async function runMigration(
  onProgress?: (step: number, total: number, desc: string) => void,
): Promise<void> {
  const totalSteps = 4;
  const report = (step: number, desc: string) =>
    onProgress?.(step, totalSteps, desc);

  // ── Step 1: Generate CREATE op-log entries for all existing entities ──
  report(1, 'Creating encrypted operation log…');
  const userId = getIdentityUUID();
  const deviceId = getDeviceId();
  const hlc = new HLC(deviceId);

  const collections: { name: SyncCollection; table: Table }[] = [
    { name: 'workSessions', table: db.workSessions },
    { name: 'tickets', table: db.tickets },
    { name: 'notes', table: db.notes },
    { name: 'projects', table: db.projects },
    { name: 'activityLogs', table: db.activityLogs },
  ];

  const opEntries: OpLogEntry[] = [];

  for (const { name, table } of collections) {
    const records = await table.toArray();
    for (const record of records) {
      // Skip soft-deleted records
      if ((record as any)._deleted) continue;

      const ts = hlc.now();
      const snapshot = { ...record } as Record<string, unknown>;

      // Strip legacy sync fields from the snapshot
      delete snapshot._dirty;
      delete snapshot._serverId;
      delete snapshot._rev;

      // Timehuddle tickets require manual sync approval; everything else auto-syncs
      const isTimehuddleTicket = name === 'tickets' && snapshot.source === 'timehuddle';

      opEntries.push({
        id: uuidv4(),
        deviceId,
        userId,
        timestamp: new Date(ts.physical).toISOString(),
        hlc: pack(ts),
        collection: name,
        operation: 'CREATE',
        entityId: (record as any).id,
        snapshot,
        _synced: 0,
        _syncEnabled: isTimehuddleTicket ? 0 : 1,
      });
    }
  }

  // Batch-write all op-log entries
  if (opEntries.length > 0) {
    await db.opLog.bulkAdd(opEntries);
  }

  // ── Step 2: Add _fieldHLC to every entity ──
  report(2, 'Adding field-level timestamps…');
  const baseHLC = pack(hlc.now());

  for (const { table } of collections) {
    const records = await table.toArray();
    for (const record of records) {
      if ((record as any)._deleted) continue;

      const fieldHLC: FieldHLCMap = {};
      for (const key of Object.keys(record as any)) {
        if (key === 'id' || key.startsWith('_')) continue;
        fieldHLC[key] = baseHLC;
      }

      await (table as any).update((record as any).id, { _fieldHLC: fieldHLC });
    }
  }

  // ── Step 3: Strip legacy sync fields from all records ──
  report(3, 'Removing legacy sync fields…');
  for (const { table } of collections) {
    await table.toCollection().modify((record: Record<string, unknown>) => {
      delete record._dirty;
      delete record._serverId;
      delete record._rev;
    });
  }

  // ── Step 4: Mark migration complete ──
  report(4, 'Finalizing migration…');
  await db.syncMeta.put({
    collection: MIGRATION_KEY,
    lastPulledAt: TARGET_VERSION,
  });

  console.log(
    `Migration complete: ${opEntries.length} entities migrated to encrypted op-log.`,
  );
}
