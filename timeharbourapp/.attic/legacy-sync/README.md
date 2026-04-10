# Legacy Sync — Archived Code

**Archived on:** 2026-04-02
**Reason:** Phase 5 cleanup of the Dexie-first encrypted op-log sync migration.

## What was removed

### SyncEngine.ts
The original dirty-flag push/pull sync engine. Replaced by:
- `TimeharborAPI/sync/EncryptedSyncEngine.ts` (E2E encrypted op-log sync)
- `TimeharborAPI/sync/OpLogWriter.ts` (records mutations as op-log entries)

The legacy engine used `_dirty: 1` flags on each entity and pushed/pulled
unencrypted JSON payloads to/from MongoDB. The new system uses a Hybrid
Logical Clock (HLC), per-field Last-Writer-Wins conflict resolution, and
AES-256-GCM encryption so the server only relays opaque blobs.

## Migration context

All clients had a 30-day window (Phase 4) to run the MigrationService,
which converted `_dirty`/`_serverId`/`_rev` records to HLC-based op-log
entries. After that window, this legacy code was removed.
