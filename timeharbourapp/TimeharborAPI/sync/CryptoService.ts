/**
 * CryptoService — AES-256-GCM encryption powered by the WebCrypto API.
 *
 * Works in all target environments:
 *   • Modern browsers (Chrome 60+, Safari 15+, Firefox 57+)
 *   • iOS WKWebView  (Capacitor)
 *   • Android WebView (Capacitor)
 *
 * Key hierarchy:
 *   passphrase  ──PBKDF2──▶  masterKey  ──HKDF──▶  syncKey
 *
 * The masterKey is used to wrap/unwrap the syncKey.
 * The syncKey encrypts op-log entries before they leave the device.
 */

import type { EncryptedPayload } from './types';
import { toBase64, fromBase64 } from './encoding';

// ── Constants ───────────────────────────────────────────────

const PBKDF2_ITERATIONS = 600_000; // OWASP 2023 recommendation
const AES_KEY_BITS = 256;
const IV_BYTES = 12; // 96-bit IV for AES-GCM
const SALT_BYTES = 16;
const HKDF_INFO_SYNC = new TextEncoder().encode('timeharbor-sync-key');

// ── Salt / IV generation ────────────────────────────────────

/** Generate a cryptographically random salt. */
export function generateSalt(): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(SALT_BYTES));
}

/** Generate a random 96-bit IV for AES-GCM. */
function generateIV(): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(IV_BYTES));
}

// ── Key derivation ──────────────────────────────────────────

/**
 * Derive a master CryptoKey from a user-supplied passphrase + salt
 * using PBKDF2-SHA-256.
 */
export async function deriveMasterKey(
  passphrase: string,
  salt: Uint8Array<ArrayBuffer>,
): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: AES_KEY_BITS },
    true, // extractable — so we can export / wrap
    ['wrapKey', 'unwrapKey'],
  );
}

/**
 * Derive the sync key from the master key using HKDF-SHA-256.
 * The sync key is what actually encrypts op-log payloads.
 */
export async function deriveSyncKey(masterKey: CryptoKey): Promise<CryptoKey> {
  // Export master raw bytes so we can feed them into HKDF as key material.
  const raw = await crypto.subtle.exportKey('raw', masterKey);
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    raw,
    'HKDF',
    false,
    ['deriveKey'],
  );

  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(0), // deterministic — same master → same sync key
      info: HKDF_INFO_SYNC,
    },
    keyMaterial,
    { name: 'AES-GCM', length: AES_KEY_BITS },
    false, // non-extractable — used only for encrypt/decrypt
    ['encrypt', 'decrypt'],
  );
}

// ── Encrypt / Decrypt ───────────────────────────────────────

/**
 * Encrypt a plaintext string with AES-256-GCM.
 * Returns base-64-encoded IV and ciphertext for safe JSON transport.
 */
export async function encrypt(
  plaintext: string,
  key: CryptoKey,
): Promise<EncryptedPayload> {
  const iv = generateIV();
  const encoded = new TextEncoder().encode(plaintext);

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded,
  );

  return {
    iv: toBase64(iv),
    ciphertext: toBase64(cipherBuffer),
  };
}

/**
 * Decrypt an AES-256-GCM payload back to a plaintext string.
 * Throws if the key is wrong or the data has been tampered with.
 */
export async function decrypt(
  payload: EncryptedPayload,
  key: CryptoKey,
): Promise<string> {
  const iv = fromBase64(payload.iv);
  const ciphertext = fromBase64(payload.ciphertext);

  const plainBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext,
  );

  return new TextDecoder().decode(plainBuffer);
}

// ── Key wrapping (for persisting the sync key) ─────────────

/**
 * Wrap (encrypt) a CryptoKey with the master key so it can be stored
 * safely in IndexedDB or transmitted.
 */
export async function wrapKey(
  keyToWrap: CryptoKey,
  masterKey: CryptoKey,
): Promise<EncryptedPayload> {
  const iv = generateIV();

  const wrapped = await crypto.subtle.wrapKey(
    'raw',
    keyToWrap,
    masterKey,
    { name: 'AES-GCM', iv },
  );

  return {
    iv: toBase64(iv),
    ciphertext: toBase64(wrapped),
  };
}

/**
 * Unwrap a previously wrapped key using the master key.
 */
export async function unwrapKey(
  wrapped: EncryptedPayload,
  masterKey: CryptoKey,
): Promise<CryptoKey> {
  const iv = fromBase64(wrapped.iv);
  const ciphertext = fromBase64(wrapped.ciphertext);

  return crypto.subtle.unwrapKey(
    'raw',
    ciphertext,
    masterKey,
    { name: 'AES-GCM', iv },
    { name: 'AES-GCM', length: AES_KEY_BITS },
    false,
    ['encrypt', 'decrypt'],
  );
}
