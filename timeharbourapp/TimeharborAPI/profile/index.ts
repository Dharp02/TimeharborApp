import { db, type DexieUserProfile } from '../db';
import { getIdentityUUID } from '../sync/IdentityManager';
import { operationsLog } from '../OperationsLog';
import { opLogWriter } from '../sync/OpLogWriter';

/**
 * Get the current user's profile from Dexie.
 */
export async function getProfile(userId?: string): Promise<DexieUserProfile | undefined> {
  const uid = userId ?? getIdentityUUID();
  return db.userProfiles.get(uid);
}

export interface UpsertProfileData {
  displayName?: string;
  email?: string;
  avatarBase64?: string | null;
  githubUrl?: string;
  linkedinUrl?: string;
  redmineUrl?: string;
}

/**
 * Create or update the user's profile in Dexie and record an op-log entry.
 */
export async function upsertProfile(data: UpsertProfileData): Promise<DexieUserProfile> {
  const userId = getIdentityUUID();
  const now = new Date().toISOString();
  const existing = await db.userProfiles.get(userId);

  if (existing) {
    // UPDATE — only send changed fields as patch
    const patch: Record<string, unknown> = { updatedAt: now };
    if (data.displayName !== undefined) patch.displayName = data.displayName;
    if (data.email !== undefined) patch.email = data.email;
    if (data.avatarBase64 !== undefined) patch.avatarBase64 = data.avatarBase64;
    if (data.githubUrl !== undefined) patch.githubUrl = data.githubUrl;
    if (data.linkedinUrl !== undefined) patch.linkedinUrl = data.linkedinUrl;
    if (data.redmineUrl !== undefined) patch.redmineUrl = data.redmineUrl;

    const updated: DexieUserProfile = { ...existing, ...patch, updatedAt: now };
    try {
      await db.userProfiles.put(updated);
      await opLogWriter.recordUpdate('userProfiles', userId, patch);
      await operationsLog.log({ category: 'PROFILE', action: 'UPDATE', result: 'success', target: 'UserProfile', targetId: userId, details: { fields: Object.keys(data) } });
      return updated;
    } catch (err: any) {
      await operationsLog.log({ category: 'PROFILE', action: 'UPDATE', result: 'failure', target: 'UserProfile', targetId: userId, errorMessage: err?.message });
      throw err;
    }
  } else {
    // CREATE — full snapshot
    const profile: DexieUserProfile = {
      id: userId,
      userId,
      displayName: data.displayName,
      email: data.email,
      avatarBase64: data.avatarBase64 ?? null,
      githubUrl: data.githubUrl,
      linkedinUrl: data.linkedinUrl,
      redmineUrl: data.redmineUrl,
      createdAt: now,
      updatedAt: now,
    };
    try {
      await db.userProfiles.put(profile);
      await opLogWriter.recordCreate('userProfiles', userId, profile as unknown as Record<string, unknown>);
      await operationsLog.log({ category: 'PROFILE', action: 'CREATE', result: 'success', target: 'UserProfile', targetId: userId });
      return profile;
    } catch (err: any) {
      await operationsLog.log({ category: 'PROFILE', action: 'CREATE', result: 'failure', target: 'UserProfile', targetId: userId, errorMessage: err?.message });
      throw err;
    }
  }
}

/**
 * Update the avatar as a base64 data URL in Dexie + op-log.
 */
export async function updateAvatar(base64DataUrl: string): Promise<void> {
  const userId = getIdentityUUID();
  const now = new Date().toISOString();
  const existing = await db.userProfiles.get(userId);

  const patch = { avatarBase64: base64DataUrl, updatedAt: now };

  if (existing) {
    try {
      await db.userProfiles.update(userId, patch);
      await opLogWriter.recordUpdate('userProfiles', userId, patch);
      await operationsLog.log({ category: 'PROFILE', action: 'UPDATE', result: 'success', target: 'Avatar', targetId: userId });
    } catch (err: any) {
      await operationsLog.log({ category: 'PROFILE', action: 'UPDATE', result: 'failure', target: 'Avatar', targetId: userId, errorMessage: err?.message });
      throw err;
    }
  } else {
    // No profile yet — create one with just the avatar
    const profile: DexieUserProfile = {
      id: userId,
      userId,
      avatarBase64: base64DataUrl,
      createdAt: now,
      updatedAt: now,
    };
    try {
      await db.userProfiles.put(profile);
      await opLogWriter.recordCreate('userProfiles', userId, profile as unknown as Record<string, unknown>);
      await operationsLog.log({ category: 'PROFILE', action: 'CREATE', result: 'success', target: 'Avatar', targetId: userId });
    } catch (err: any) {
      await operationsLog.log({ category: 'PROFILE', action: 'CREATE', result: 'failure', target: 'Avatar', targetId: userId, errorMessage: err?.message });
      throw err;
    }
  }
}

/**
 * Remove the avatar from profile in Dexie + op-log.
 */
export async function removeAvatar(): Promise<void> {
  const userId = getIdentityUUID();
  const now = new Date().toISOString();
  const existing = await db.userProfiles.get(userId);
  if (!existing) return;

  const patch = { avatarBase64: undefined, updatedAt: now };
  try {
    await db.userProfiles.update(userId, patch);
    await opLogWriter.recordUpdate('userProfiles', userId, { avatarBase64: null, updatedAt: now });
    await operationsLog.log({ category: 'PROFILE', action: 'DELETE', result: 'success', target: 'Avatar', targetId: userId });
  } catch (err: any) {
    await operationsLog.log({ category: 'PROFILE', action: 'DELETE', result: 'failure', target: 'Avatar', targetId: userId, errorMessage: err?.message });
    throw err;
  }
}
