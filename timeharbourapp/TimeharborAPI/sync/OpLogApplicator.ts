/**
 * OpLogApplicator — applies decrypted remote op-log entries to local Dexie.
 *
 * This is the conflict-resolution heart of the sync system.
 * Strategy: **per-field Last-Writer-Wins (LWW)** using HLC timestamps.
 *
 *   CREATE  → insert if entity doesn't exist, skip if it does (idempotent)
 *   UPDATE  → merge patch fields; only overwrite a field if remote HLC > local HLC
 *   DELETE  → soft-delete (set _deleted: true)
 *
 * All operations are idempotent — re-applying the same op is a no-op.
 */

import { db } from '../db';
import { compare as hlcCompare } from './HLC';
import type { OpLogEntry, SyncCollection, FieldHLCMap } from './types';
import type { Table } from 'dexie';

// ── Public API ──────────────────────────────────────────────

/**
 * Apply a batch of remote op-log entries to local Dexie.
 *
 * Entries are processed in HLC order to respect causality.
 * Already-applied ops (tracked in `appliedOps`) are skipped.
 */
export async function applyRemoteOps(entries: OpLogEntry[]): Promise<void> {
  // Sort by HLC for causal ordering
  const sorted = [...entries].sort((a, b) => hlcCompare(a.hlc, b.hlc));

  for (const entry of sorted) {
    // Idempotency: skip if already applied
    const existing = await db.appliedOps.get(entry.id);
    if (existing) continue;

    await applyOne(entry);

    // Record that this op was applied
    await db.appliedOps.put({
      id: entry.id,
      appliedAt: new Date().toISOString(),
    });
  }
}

// ── Internal: per-entry dispatch ────────────────────────────

async function applyOne(entry: OpLogEntry): Promise<void> {
  switch (entry.operation) {
    case 'CREATE':
      return applyCreate(entry);
    case 'UPDATE':
      return applyUpdate(entry);
    case 'DELETE':
      return applyDelete(entry);
  }
}

// ── CREATE ──────────────────────────────────────────────────

async function applyCreate(entry: OpLogEntry): Promise<void> {
  const table = getTable(entry.collection);
  if (!table || !entry.snapshot) return;

  // Idempotent: don't re-insert if entity already exists
  const local = await table.get(entry.entityId);
  if (local) return;

  // Build initial field HLC map — every field gets this op's HLC
  const fieldHLC: FieldHLCMap = {};
  for (const key of Object.keys(entry.snapshot)) {
    fieldHLC[key] = entry.hlc;
  }

  await table.put({
    ...entry.snapshot,
    id: entry.entityId,
    _fieldHLC: fieldHLC,
  });
}

// ── UPDATE ──────────────────────────────────────────────────

async function applyUpdate(entry: OpLogEntry): Promise<void> {
  const table = getTable(entry.collection);
  if (!table || !entry.patch) return;

  const local = await table.get(entry.entityId);
  if (!local) {
    // Entity doesn't exist locally — can't apply a patch.
    // This can happen if the CREATE op hasn't arrived yet.
    // We skip it; the CREATE + subsequent UPDATEs will catch up.
    return;
  }

  const localFieldHLC: FieldHLCMap = local._fieldHLC ?? {};
  const mergedFields: Record<string, unknown> = {};
  const mergedFieldHLC: FieldHLCMap = { ...localFieldHLC };

  for (const [field, value] of Object.entries(entry.patch)) {
    const localHLC = localFieldHLC[field];

    // Accept the remote value if:
    //   1. Local has no HLC for this field (never written locally), OR
    //   2. Remote HLC is strictly greater than the local field HLC
    if (!localHLC || hlcCompare(entry.hlc, localHLC) > 0) {
      mergedFields[field] = value;
      mergedFieldHLC[field] = entry.hlc;
    }
    // Otherwise: local wins — skip this field
  }

  // Only write if we accepted any remote fields
  if (Object.keys(mergedFields).length > 0) {
    await table.update(entry.entityId, {
      ...mergedFields,
      _fieldHLC: mergedFieldHLC,
    });
  }
}

// ── DELETE ──────────────────────────────────────────────────

async function applyDelete(entry: OpLogEntry): Promise<void> {
  const table = getTable(entry.collection);
  if (!table) return;

  const local = await table.get(entry.entityId);
  if (!local) return; // already gone

  // Soft-delete: mark as deleted rather than hard-removing.
  // Hard purge happens during compaction after all devices confirm.
  await table.update(entry.entityId, {
    _deleted: true,
    _fieldHLC: { ...(local._fieldHLC ?? {}), _deleted: entry.hlc },
  });
}

// ── Helpers ─────────────────────────────────────────────────

/**
 * Map a sync collection name to the corresponding Dexie table.
 */
function getTable(collection: SyncCollection): Table | null {
  switch (collection) {
    case 'workSessions':
      return db.workSessions;
    case 'tickets':
      return db.tickets;
    case 'notes':
      return db.notes;
    case 'projects':
      return db.projects;
    case 'activityLogs':
      return db.activityLogs;
    default:
      return null;
  }
}
