/**
 * ProfileRegistry — manages a list of saved profiles in localStorage.
 *
 * Each profile stores the UUID, passphrase, a user-defined name,
 * and timestamps. Max 5 profiles.
 */

import { getIdentityUUID, getIdentityPassphrase } from './IdentityManager';

// ── Types ───────────────────────────────────────────────────

export interface SavedProfile {
  uuid: string;
  passphrase: string;
  name: string;
  createdAt: string;   // ISO timestamp
  lastUsedAt: string;  // ISO timestamp
}

// ── Constants ───────────────────────────────────────────────

const STORAGE_KEY = 'th_saved_profiles';
const MAX_PROFILES = 5;

// ── Read / Write ────────────────────────────────────────────

function loadProfiles(): SavedProfile[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveProfiles(profiles: SavedProfile[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
}

// ── Public API ──────────────────────────────────────────────

/** Return all saved profiles, most recently used first. */
export function getSavedProfiles(): SavedProfile[] {
  return loadProfiles().sort(
    (a, b) => new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime(),
  );
}

/** Get the currently active profile (matches the live identity UUID). */
export function getActiveProfile(): SavedProfile | undefined {
  const uuid = getIdentityUUID();
  return loadProfiles().find((p) => p.uuid === uuid);
}

/** Check whether a profile with a given UUID is already saved. */
export function hasProfile(uuid: string): boolean {
  return loadProfiles().some((p) => p.uuid === uuid);
}

/** How many profiles are saved. */
export function profileCount(): number {
  return loadProfiles().length;
}

/** Whether the user can add another profile. */
export function canAddProfile(): boolean {
  return profileCount() < MAX_PROFILES;
}

/**
 * Save a profile. If a profile with the same UUID already exists,
 * update its name and lastUsedAt. Returns false if limit reached.
 */
export function saveProfile(
  profile: Pick<SavedProfile, 'uuid' | 'passphrase' | 'name'>,
): boolean {
  const profiles = loadProfiles();
  const existing = profiles.find((p) => p.uuid === profile.uuid);
  const now = new Date().toISOString();

  if (existing) {
    existing.name = profile.name;
    existing.passphrase = profile.passphrase;
    existing.lastUsedAt = now;
    saveProfiles(profiles);
    return true;
  }

  if (profiles.length >= MAX_PROFILES) return false;

  profiles.push({
    uuid: profile.uuid,
    passphrase: profile.passphrase,
    name: profile.name,
    createdAt: now,
    lastUsedAt: now,
  });
  saveProfiles(profiles);
  return true;
}

/** Remove a profile by UUID. Cannot remove the currently active profile. */
export function removeProfile(uuid: string): boolean {
  const currentUuid = getIdentityUUID();
  if (uuid === currentUuid) return false;

  const profiles = loadProfiles();
  const filtered = profiles.filter((p) => p.uuid !== uuid);
  if (filtered.length === profiles.length) return false; // not found
  saveProfiles(filtered);
  return true;
}

/** Rename a saved profile. */
export function renameProfile(uuid: string, newName: string): boolean {
  const profiles = loadProfiles();
  const profile = profiles.find((p) => p.uuid === uuid);
  if (!profile) return false;
  profile.name = newName.trim();
  saveProfiles(profiles);
  return true;
}

/** Update lastUsedAt for the currently active profile. */
export function touchActiveProfile(): void {
  const uuid = getIdentityUUID();
  const profiles = loadProfiles();
  const profile = profiles.find((p) => p.uuid === uuid);
  if (profile) {
    profile.lastUsedAt = new Date().toISOString();
    saveProfiles(profiles);
  }
}

/**
 * Ensure the current identity is in the registry.
 * Called once during app init so the user always has their
 * active profile in the list.
 */
export function ensureCurrentProfileSaved(defaultName = 'My Profile'): void {
  const uuid = getIdentityUUID();
  if (uuid === 'ssr') return;

  if (!hasProfile(uuid)) {
    const passphrase = getIdentityPassphrase();
    saveProfile({ uuid, passphrase, name: defaultName });
  }
}
