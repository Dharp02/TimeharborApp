/**
 * Encrypted op-log sync — barrel export.
 *
 * This module provides the building blocks for end-to-end encrypted
 * synchronization using Dexie as the single source of truth.
 */

// Crypto primitives
export {
  deriveMasterKey,
  deriveSyncKey,
  generateSalt,
  encrypt,
  decrypt,
  wrapKey,
  unwrapKey,
} from './CryptoService';

// Key management (platform-aware)
export {
  setupEncryption,
  unlockEncryption,
  isEncryptionSetUp,
  clearKeys,
  getDeviceId,
} from './KeyManager';

// Identity management (auth-free local identity)
export {
  getIdentityUUID,
  getIdentityPassphrase,
  ensureIdentityAndEncryption,
  regenerateIdentity,
} from './IdentityManager';

// Hybrid Logical Clock
export { HLC, pack, unpack, compare } from './HLC';
export type { HLCTimestamp } from './HLC';

// Op-log writer
export { opLogWriter, resetHLC } from './OpLogWriter';

// Encrypted sync engine (push / pull / compaction)
export { pushOpLog, pullOpLog, syncAll, compactOpLog } from './EncryptedSyncEngine';

// Op-log applicator (conflict resolution)
export { applyRemoteOps } from './OpLogApplicator';

// Migration (legacy → encrypted)
export { isMigrated, runMigration } from './MigrationService';

// Encoding helpers
export { toBase64, fromBase64 } from './encoding';

// Types
export type {
  OpLogEntry,
  OpType,
  SyncCollection,
  EncryptedPayload,
  EncryptedOpLogBatch,
  StoredKeyRecord,
  FieldHLCMap,
} from './types';
