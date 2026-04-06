/**
 * KeyManager — platform-aware encryption key storage.
 *
 * On **web**: keys are stored in the Dexie `deviceKeys` table,
 * wrapped (encrypted) with a key derived from the user's passphrase.
 *
 * On **native** (Capacitor iOS / Android): the raw master key is stored
 * in the OS Keychain / Keystore via a secure-storage plugin, with
 * a Dexie fallback until the native plugin is installed.
 *
 * The KeyManager never exposes the raw master key as a string — callers
 * receive a CryptoKey handle that can only be used via WebCrypto.
 */

import { Capacitor } from '@capacitor/core';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import { toBase64, fromBase64 } from './encoding';
import {
  deriveMasterKey,
  deriveSyncKey,
  derivePassphraseSalt,
  generateSalt,
  wrapKey,
  unwrapKey,
} from './CryptoService';
import type { StoredKeyRecord } from './types';

// ── Device ID ───────────────────────────────────────────────

const DEVICE_ID_KEY = 'th_device_id';

/** Persistent device identifier (survives app restarts). */
export function getDeviceId(): string {
  if (typeof window === 'undefined') return 'ssr';
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = uuidv4();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

// ── Native secure storage helpers ───────────────────────────

/**
 * Dynamically import the Capacitor secure-storage plugin.
 * Returns `null` on web or if the plugin is not installed.
 */
async function getNativeSecureStorage(): Promise<{
  get: (opts: { key: string }) => Promise<{ value: string }>;
  set: (opts: { key: string; value: string }) => Promise<void>;
  remove: (opts: { key: string }) => Promise<void>;
} | null> {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    // Dynamic import so web builds don't pull in native code.
    // @ts-expect-error — plugin may not be installed; that's handled by the catch
    const mod = await import('@capacitor-community/secure-storage-plugin');
    return mod.SecureStoragePlugin;
  } catch {
    // Plugin not installed — fall back to Dexie.
    return null;
  }
}

// ── Public API ──────────────────────────────────────────────

/**
 * Initialise encryption for a new user / device.
 *
 * 1. Derive a masterKey from the passphrase + fresh salt.
 * 2. Derive a syncKey from the masterKey.
 * 3. Store the wrapped masterKey (+ salt) so the passphrase can
 *    recreate it later.
 *
 * Returns the ready-to-use syncKey.
 */
export async function setupEncryption(passphrase: string): Promise<CryptoKey> {
  // Use a deterministic salt so the same passphrase produces the same
  // sync key on every device — required for cross-device decryption.
  const salt = await derivePassphraseSalt(passphrase);
  const masterKey = await deriveMasterKey(passphrase, salt);
  const syncKey = await deriveSyncKey(masterKey);

  // Persist the master key
  await storeMasterKey(masterKey, salt);

  return syncKey;
}

/**
 * Unlock encryption on an existing device using the passphrase.
 *
 * Reads the stored salt, re-derives the masterKey, then derives the syncKey.
 */
export async function unlockEncryption(
  passphrase: string,
): Promise<CryptoKey> {
  const record = await loadMasterKeyRecord();
  if (!record) {
    throw new Error('No encryption keys found — run setupEncryption first.');
  }

  const salt = fromBase64(record.salt);
  const masterKey = await deriveMasterKey(passphrase, salt);

  // Verify the passphrase by attempting to unwrap the stored key.
  // If the passphrase is wrong, unwrapKey will throw.
  await unwrapKey(
    { iv: record.encryptedKey.split(':')[0], ciphertext: record.encryptedKey.split(':')[1] },
    masterKey,
  );

  return deriveSyncKey(masterKey);
}

/**
 * Check whether encryption has been set up on this device.
 */
export async function isEncryptionSetUp(): Promise<boolean> {
  const record = await loadMasterKeyRecord();
  return record !== null;
}

/**
 * Remove all stored keys (e.g., on sign-out).
 */
export async function clearKeys(): Promise<void> {
  const secureStorage = await getNativeSecureStorage();
  if (secureStorage) {
    try { await secureStorage.remove({ key: 'th_master_key' }); } catch { /* ok */ }
    try { await secureStorage.remove({ key: 'th_master_salt' }); } catch { /* ok */ }
  }
  await db.deviceKeys.clear();
  await db.cachedKeys.clear();
}

// ── Sync key cache (skip passphrase on reload) ──────────────

/**
 * Persist the sync key in IndexedDB so the user doesn't have to
 * re-enter the passphrase on every page load.
 * Cleared on sign-out via clearDatabase() / clearKeys().
 */
export async function cacheSyncKey(syncKey: CryptoKey): Promise<void> {
  await db.cachedKeys.put({ id: 'sync', key: syncKey });
}

/**
 * Load the cached sync key from IndexedDB.
 * Returns null if not found (first visit or after sign-out).
 */
export async function loadCachedSyncKey(): Promise<CryptoKey | null> {
  try {
    const record = await db.cachedKeys.get('sync');
    return record?.key ?? null;
  } catch {
    return null;
  }
}

// ── Internal helpers ────────────────────────────────────────

async function storeMasterKey(
  masterKey: CryptoKey,
  salt: Uint8Array,
): Promise<void> {
  const secureStorage = await getNativeSecureStorage();

  if (secureStorage) {
    // Native: store raw key bytes in Keychain / Keystore
    const raw = await crypto.subtle.exportKey('raw', masterKey);
    await secureStorage.set({
      key: 'th_master_key',
      value: toBase64(raw),
    });
    await secureStorage.set({
      key: 'th_master_salt',
      value: toBase64(salt),
    });
  } else {
    // Web: wrap the master key with itself (the passphrase can recreate
    // the wrapping key via PBKDF2), then store in Dexie.
    const wrapped = await wrapKey(masterKey, masterKey);
    const record: StoredKeyRecord = {
      id: 'master',
      encryptedKey: `${wrapped.iv}:${wrapped.ciphertext}`,
      salt: toBase64(salt),
      createdAt: new Date().toISOString(),
    };
    await db.deviceKeys.put(record);
  }
}

async function loadMasterKeyRecord(): Promise<StoredKeyRecord | null> {
  const secureStorage = await getNativeSecureStorage();

  if (secureStorage) {
    try {
      const keyB64 = await secureStorage.get({ key: 'th_master_key' });
      const saltB64 = await secureStorage.get({ key: 'th_master_salt' });
      return {
        id: 'master',
        encryptedKey: keyB64.value, // raw b64 on native
        salt: saltB64.value,
        createdAt: '',
      };
    } catch {
      return null;
    }
  }

  // Web: read from Dexie
  const record = await db.deviceKeys.get('master');
  return record ?? null;
}
