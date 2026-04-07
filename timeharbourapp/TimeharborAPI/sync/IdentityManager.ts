/**
 * IdentityManager — auto-generates and persists a local identity
 * (UUID + passphrase + encryption key) on first launch.
 *
 * No user interaction required. The identity is stored in localStorage
 * and Dexie, and used as the auth token for the sync relay.
 */

import { v4 as uuidv4 } from 'uuid';
import { toBase64 } from './encoding';
import { db } from '../db';
import {
  setupEncryption,
  isEncryptionSetUp,
  loadCachedSyncKey,
  cacheSyncKey,
  unlockEncryption,
} from './KeyManager';

// ── LocalStorage keys ───────────────────────────────────────

const IDENTITY_UUID_KEY = 'th_identity_uuid';
const IDENTITY_PASSPHRASE_KEY = 'th_identity_passphrase';

// ── UUID ────────────────────────────────────────────────────

/** Get or create the local user UUID. */
export function getIdentityUUID(): string {
  if (typeof window === 'undefined') return 'ssr';
  let uuid = localStorage.getItem(IDENTITY_UUID_KEY);
  if (!uuid) {
    uuid = uuidv4();
    localStorage.setItem(IDENTITY_UUID_KEY, uuid);
  }
  return uuid;
}

// ── Passphrase ──────────────────────────────────────────────

/** Generate a cryptographically random passphrase (44 chars base64). */
function generatePassphrase(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return toBase64(bytes);
}

/** Get or create the local passphrase. */
export function getIdentityPassphrase(): string {
  if (typeof window === 'undefined') return '';
  let passphrase = localStorage.getItem(IDENTITY_PASSPHRASE_KEY);
  if (!passphrase) {
    passphrase = generatePassphrase();
    localStorage.setItem(IDENTITY_PASSPHRASE_KEY, passphrase);
  }
  return passphrase;
}

// ── Auto-setup ──────────────────────────────────────────────

/**
 * Ensure encryption is set up silently on first launch.
 *
 * Returns the sync key ready for use.
 * - If a cached sync key exists → return it
 * - If encryption was set up but not cached → unlock with stored passphrase
 * - If nothing is set up → generate passphrase + setup encryption
 */
export async function ensureIdentityAndEncryption(): Promise<CryptoKey> {
  // 1. Try cached sync key first (fastest path — skip all derivation)
  const cached = await loadCachedSyncKey();
  if (cached) return cached;

  const passphrase = getIdentityPassphrase();

  // 2. If encryption was already set up (keys in Dexie/Keychain),
  //    just unlock with the stored passphrase
  const hasKeys = await isEncryptionSetUp();
  if (hasKeys) {
    const syncKey = await unlockEncryption(passphrase);
    await cacheSyncKey(syncKey);
    return syncKey;
  }

  // 3. First time — set up encryption with the auto-generated passphrase
  const syncKey = await setupEncryption(passphrase);
  await cacheSyncKey(syncKey);
  return syncKey;
}

// ── Key regeneration ────────────────────────────────────────

/**
 * Regenerate the passphrase and encryption key.
 * Returns the new passphrase (for display to the user) and the new sync key.
 *
 * IMPORTANT: After calling this, all server data encrypted with the old key
 * becomes unreadable. The caller must re-encrypt and re-push all local data.
 */
export async function regenerateIdentity(): Promise<{
  passphrase: string;
  syncKey: CryptoKey;
}> {
  // Generate a new passphrase
  const passphrase = generatePassphrase();
  localStorage.setItem(IDENTITY_PASSPHRASE_KEY, passphrase);

  // Setup encryption with the new passphrase (overwrites old keys)
  const syncKey = await setupEncryption(passphrase);
  await cacheSyncKey(syncKey);

  return { passphrase, syncKey };
}

// ── Auth → Identity userId migration ────────────────────────

const USERID_MIGRATION_KEY = 'th_userid_migrated';

/**
 * Detect if the user previously had data stored under an auth user.id
 * and migrate all Dexie records to use the identity UUID instead.
 *
 * This runs once — on first launch after the auth-free transition.
 * It finds ALL records with a userId/createdBy that doesn't match the
 * current identity UUID and updates them.
 */
export async function migrateAuthUserIdToIdentity(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (localStorage.getItem(USERID_MIGRATION_KEY)) return;

  const identityUUID = getIdentityUUID();

  // Try to find old auth user IDs from various sources
  const oldUserIds = new Set<string>();

  // 1. From cached auth user in localStorage
  try {
    const raw = localStorage.getItem('th_cached_user');
    if (raw) {
      const cached = JSON.parse(raw);
      if (cached?.id && cached.id !== identityUUID) {
        oldUserIds.add(cached.id);
      }
    }
  } catch { /* parse error */ }

  // 2. Scan Dexie tables for any userId that isn't the identity UUID
  const tables = [
    { table: db.workSessions, field: 'userId' },
    { table: db.notes, field: 'userId' },
    { table: db.activityLogs, field: 'userId' },
  ];

  for (const { table, field } of tables) {
    try {
      const records = await table.toArray();
      for (const record of records) {
        const val = (record as any)[field];
        if (val && val !== identityUUID) {
          oldUserIds.add(val);
        }
      }
    } catch { /* table might not exist yet */ }
  }

  // Also check createdBy fields
  const createdByTables = [
    { table: db.tickets },
    { table: db.projects },
  ];

  for (const { table } of createdByTables) {
    try {
      const records = await table.toArray();
      for (const record of records) {
        const val = (record as any).createdBy;
        if (val && val !== identityUUID) {
          oldUserIds.add(val);
        }
      }
    } catch { /* table might not exist yet */ }
  }

  if (oldUserIds.size === 0) {
    localStorage.setItem(USERID_MIGRATION_KEY, '1');
    return;
  }

  console.log('[identity] migrating userId from', [...oldUserIds], 'to', identityUUID);

  // Migrate all records
  for (const oldId of oldUserIds) {
    // workSessions: indexed on userId
    await db.workSessions
      .where('userId').equals(oldId)
      .modify({ userId: identityUUID });

    // notes: indexed on userId
    await db.notes
      .where('userId').equals(oldId)
      .modify({ userId: identityUUID });

    // activityLogs: has userId field
    await db.activityLogs
      .where('userId').equals(oldId)
      .modify({ userId: identityUUID });

    // tickets: createdBy field (not indexed on it for queries, but update anyway)
    await db.tickets.toCollection()
      .filter((t: any) => t.createdBy === oldId)
      .modify({ createdBy: identityUUID });

    // projects: createdBy field
    await db.projects
      .where('createdBy').equals(oldId)
      .modify({ createdBy: identityUUID });

    // opLog: userId field
    await db.opLog.toCollection()
      .filter((e: any) => e.userId === oldId)
      .modify({ userId: identityUUID, _synced: 0 });
  }

  console.log('[identity] userId migration complete');
  localStorage.setItem(USERID_MIGRATION_KEY, '1');
}
