/**
 * RecoveryKeyService — encode / decode a single recovery key
 * that combines the identity UUID and passphrase.
 *
 * Format:  TH1-{base64url(uuid.passphrase)}
 *
 * Storage: saved directly into the browser's credential manager
 * (Chrome → Google Password Manager, Safari → iCloud Keychain,
 * Edge → Microsoft Autofill).  The key never appears as copyable text.
 *
 * The `TH1` prefix identifies the version so future formats can
 * be introduced without ambiguity.
 */

import { Capacitor } from '@capacitor/core';
import { getIdentityUUID, getIdentityPassphrase } from './IdentityManager';
import { getApiUrl } from '../apiUrl';

// ── Constants ───────────────────────────────────────────────

const KEY_VERSION = 'TH1';
const SEPARATOR = '.';
/** Credential ID used in the browser password manager. */
const CREDENTIAL_ID = 'timeharbor-recovery';
/** Server identifier used in native Keychain / Keystore. */
const NATIVE_KEYCHAIN_SERVER = 'timeharbor-recovery-key';

// ── Encode / Decode ─────────────────────────────────────────

/**
 * Build a recovery key from the current identity UUID & passphrase.
 * Returns a string like `TH1-eyJ1dWlk...`
 */
export function buildRecoveryKey(): string {
  const uuid = getIdentityUUID();
  const passphrase = getIdentityPassphrase();
  const payload = `${uuid}${SEPARATOR}${passphrase}`;
  const encoded = toBase64Url(payload);
  return `${KEY_VERSION}-${encoded}`;
}

/**
 * Parse a recovery key and extract the UUID + passphrase.
 * Throws if the key is malformed.
 */
export function parseRecoveryKey(key: string): { uuid: string; passphrase: string } {
  const trimmed = key.trim();

  if (!trimmed.startsWith(`${KEY_VERSION}-`)) {
    throw new Error('Invalid recovery key format.');
  }

  const encoded = trimmed.slice(KEY_VERSION.length + 1);
  const payload = fromBase64Url(encoded);
  const sepIndex = payload.indexOf(SEPARATOR);

  if (sepIndex === -1) {
    throw new Error('Invalid recovery key format.');
  }

  const uuid = payload.slice(0, sepIndex);
  const passphrase = payload.slice(sepIndex + 1);

  if (!uuid || !passphrase) {
    throw new Error('Invalid recovery key — missing UUID or passphrase.');
  }

  // Basic UUID v4 validation
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid)) {
    throw new Error('Invalid recovery key — malformed UUID.');
  }

  return { uuid, passphrase };
}

// ── Server: recovery-key-saved flag ─────────────────────────

async function apiRequest(path: string, options: RequestInit = {}) {
  const base = getApiUrl().replace(/\/api\/?$/, '');
  
  // Split path into base path and query string to safely append trailing slash
  const [rawPath, ...queryParts] = path.split('?');
  const query = queryParts.join('?');
  // Ensure the path has a trailing slash to avoid Next.js 308 redirects
  const canonicalPath = rawPath.endsWith('/') ? rawPath : `${rawPath}/`;
  const url = `${base}/api/timeharbor${canonicalPath}${query ? `?${query}` : ''}`;
  const identityUUID = getIdentityUUID();

  const headers: Record<string, string> = {
    'X-App-Id': 'timeharbor',
    'X-Identity-UUID': identityUUID,
  };

  // Only set Content-Type for requests that carry a body
  if (options.body) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      ...headers,
      ...options.headers,
    },
  });
  if (!res.ok) {
    throw new Error(`RecoveryKeyService: ${res.status} ${res.statusText} — ${path}`);
  }
  return res.json();
}

/**
 * Mark that the user has saved their recovery key.
 * After this, the "Save Key" button is disabled for this UUID.
 */
export async function markRecoveryKeySaved(): Promise<void> {
  await apiRequest('/sync/recovery-key/saved', { method: 'POST' });
}

/**
 * Check whether the recovery key has already been saved for this UUID.
 */
export async function isRecoveryKeySaved(): Promise<boolean> {
  const { saved } = await apiRequest('/sync/recovery-key/status') as { saved: boolean };
  return saved;
}

/**
 * Reset the recovery-key-saved flag (e.g. after key regeneration).
 */
export async function resetRecoveryKeySaved(): Promise<void> {
  await apiRequest('/sync/recovery-key/saved', { method: 'DELETE' });
}

// ── Browser Credential Manager (Google Password Manager / iCloud Keychain) ──

/**
 * Check whether the browser supports the Credential Management API
 * for password storage (PasswordCredential).
 */
export function isCredentialManagerAvailable(): boolean {
  return (
    typeof window !== 'undefined' &&
    'credentials' in navigator &&
    'PasswordCredential' in window
  );
}

/**
 * Save the recovery key directly into the browser's credential manager.
 *
 * - Chrome → Google Password Manager (synced to Google account)
 * - Edge → Microsoft Autofill (synced to Microsoft account)
 * - Safari → iCloud Keychain (via form-based fallback)
 *
 * The key is stored as a password credential so the user never sees
 * or copies raw key material.
 */
export async function saveToCredentialManager(): Promise<void> {
  const recoveryKey = buildRecoveryKey();

  if (!isCredentialManagerAvailable()) {
    throw new Error('CREDENTIAL_MANAGER_UNAVAILABLE');
  }

  const cred = new (window as any).PasswordCredential({
    id: CREDENTIAL_ID,
    name: 'TimeHarbor Recovery Key',
    password: recoveryKey,
  });

  await navigator.credentials.store(cred);
}

/**
 * Retrieve the recovery key from the browser's credential manager.
 *
 * Returns the TH1-... key string, or null if not found / user cancelled.
 */
export async function loadFromCredentialManager(): Promise<string | null> {
  if (!isCredentialManagerAvailable()) {
    return null;
  }

  try {
    const cred = await navigator.credentials.get({
      password: true,
      mediation: 'optional',
    } as CredentialRequestOptions);

    if (cred && 'password' in cred && typeof (cred as any).password === 'string') {
      const password = (cred as any).password as string;
      // Validate it's actually a TH1 recovery key
      if (password.startsWith(`${KEY_VERSION}-`)) {
        return password;
      }
    }
  } catch {
    // User cancelled or API error
  }

  return null;
}

// ── Native Keychain (iOS Keychain / Android Keystore via NativeBiometric) ──

/**
 * Check whether the app is running on a native platform (iOS / Android)
 * where we can use the NativeBiometric plugin for secure credential storage.
 */
export function isNativeKeychainAvailable(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Save the recovery key into the native Keychain (iOS) or Keystore (Android)
 * using the @capgo/capacitor-native-biometric plugin.
 */
export async function saveToNativeKeychain(): Promise<void> {
  const recoveryKey = buildRecoveryKey();

  const { NativeBiometric } = await import('@capgo/capacitor-native-biometric');
  await NativeBiometric.setCredentials({
    username: CREDENTIAL_ID,
    password: recoveryKey,
    server: NATIVE_KEYCHAIN_SERVER,
  });
}

/**
 * Retrieve the recovery key from the native Keychain / Keystore.
 * Returns the TH1-... key string, or null if not found.
 */
export async function loadFromNativeKeychain(): Promise<string | null> {
  try {
    const { NativeBiometric } = await import('@capgo/capacitor-native-biometric');
    const cred = await NativeBiometric.getCredentials({
      server: NATIVE_KEYCHAIN_SERVER,
    });

    if (cred?.password?.startsWith(`${KEY_VERSION}-`)) {
      return cred.password;
    }
  } catch {
    // No credentials stored or plugin error
  }
  return null;
}

// ── Base64url helpers (no padding, URL-safe) ────────────────

function toBase64Url(str: string): string {
  // TextEncoder → Uint8Array → base64 → base64url
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function fromBase64Url(b64url: string): string {
  // base64url → base64 → binary → string
  let base64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  // Re-add padding
  while (base64.length % 4 !== 0) base64 += '=';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}
