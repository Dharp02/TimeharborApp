/**
 * Types for the encrypted op-log sync system.
 *
 * Dexie is the single source of truth on each device.
 * Synchronization happens via encrypted op-log entries relayed
 * through the server (which never sees plaintext).
 */

// ── Op Log ──────────────────────────────────────────────────

/** Collections that participate in op-log sync. */
export type SyncCollection =
  | 'workSessions'
  | 'tickets'
  | 'notes'
  | 'projects'
  | 'activityLogs';

/** Mutation verbs stored in the op log. */
export type OpType = 'CREATE' | 'UPDATE' | 'DELETE';

/**
 * A single operation recorded in the local op log.
 *
 * CREATE  → `snapshot` holds the full entity.
 * UPDATE  → `patch` holds only the changed fields (JSON Merge Patch).
 * DELETE  → neither field is required (entityId is enough).
 */
export interface OpLogEntry {
  /** Client-generated UUID — used for idempotency. */
  id: string;
  /** Device that originated the operation. */
  deviceId: string;
  /** Owning user (Better Auth user id). */
  userId: string;
  /** ISO 8601 wall-clock time of the mutation. */
  timestamp: string;
  /** Hybrid Logical Clock value — total ordering across devices. */
  hlc: string;
  /** Which Dexie table was affected. */
  collection: SyncCollection;
  /** The kind of mutation. */
  operation: OpType;
  /** Primary key of the affected entity. */
  entityId: string;
  /** Changed fields for UPDATE ops (JSON Merge Patch). */
  patch?: Record<string, unknown>;
  /** Full entity snapshot for CREATE ops. */
  snapshot?: Record<string, unknown>;
  /** 0 = not yet pushed to server, 1 = acknowledged. */
  _synced: 0 | 1;
  /** 0 = requires manual sync approval, 1 = auto-synced. Defaults to 1 (auto-sync). Timehuddle tickets default to 0. */
  _syncEnabled: 0 | 1;
}

// ── Encryption ──────────────────────────────────────────────

/** Output of an AES-256-GCM encryption operation. */
export interface EncryptedPayload {
  /** Base-64-encoded initialisation vector (12 bytes). */
  iv: string;
  /** Base-64-encoded ciphertext + GCM auth tag. */
  ciphertext: string;
}

/** A batch of encrypted op-log entries sent to / received from the server. */
export interface EncryptedOpLogBatch {
  /** Originating device. */
  deviceId: string;
  /** HLC of the *last* entry in the batch (for cursor-based paging). */
  lastHLC: string;
  /** Number of ops inside (metadata only — server cannot verify). */
  count: number;
  /** The encrypted blob containing the serialised OpLogEntry[]. */
  payload: EncryptedPayload;
}

// ── Key Management ──────────────────────────────────────────

/** Stored in Dexie `deviceKeys` table (web) or native Keychain (mobile). */
export interface StoredKeyRecord {
  /** Discriminator, e.g. 'master' or 'sync'. */
  id: string;
  /** Base-64-encoded encrypted key material. */
  encryptedKey: string;
  /** Base-64-encoded salt used for PBKDF2 derivation. */
  salt: string;
  /** ISO timestamp of creation. */
  createdAt: string;
}

// ── Field-level HLC tracking (added to every synced entity) ─

/**
 * Maps each field name to the HLC string of its most recent write.
 * Used for per-field last-writer-wins conflict resolution.
 */
export type FieldHLCMap = Record<string, string>;
