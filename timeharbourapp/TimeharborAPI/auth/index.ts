import { authClient } from "@/lib/auth-client";
import { Capacitor, CapacitorCookies } from "@capacitor/core";
import { SocialLogin } from "@capgo/capacitor-social-login";
import { clearDatabase } from "../db";
import { db } from "../db";
import { resetTicketState } from "../tickets";
import { operationsLog } from '../OperationsLog';

// Types — preserved from previous interface for backwards compatibility
export interface User {
  id: string;
  email: string;
  full_name?: string;
  name?: string;
  image?: string;
  email_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface Session {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface AuthResponse {
  user: User;
  session: Session;
}

export interface AuthError {
  message: string;
  details?: any[];
}

type AuthListener = (event: string, session: any) => void;
const listeners: AuthListener[] = [];

/** True while signOut() is executing — prevents the $sessionSignal listener
 *  from re-caching the user via a stale SIGNED_IN callback. */
let signingOut = false;

/** ID of the currently signed-in user. Used by the $sessionSignal listener
 *  to distinguish a genuine sign-in from a session refresh / profile update. */
let currentUserId: string | null = null;

const notifyListeners = (event: string, session: any) => {
  // Track current user so $sessionSignal can detect real sign-ins vs updates
  if (event === 'SIGNED_IN') currentUserId = session?.user?.id ?? null;
  else if (event === 'SIGNED_OUT') currentUserId = null;
  listeners.forEach((listener) => listener(event, session));
};

/** Resolve an avatar URL relative to the current origin.
 *  - Relative paths like /uploads/... get the current origin prepended
 *  - Absolute URLs (http/https/data:) are returned as-is */
function resolveImageUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  // In Capacitor prod builds, use the backend URL instead of window.location.origin
  const effectiveOrigin =
    process.env.NEXT_PUBLIC_BETTER_AUTH_URL
    || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3001');
  if (url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:')) {
    // If it's an absolute URL pointing to a different origin's /uploads/ path,
    // rewrite it to use the effective origin so it works cross-device
    if (url.includes('/uploads/')) {
      try {
        const parsed = new URL(url);
        if (parsed.origin !== effectiveOrigin && parsed.pathname.startsWith('/uploads/')) {
          return `${effectiveOrigin}${parsed.pathname}`;
        }
      } catch { /* not a valid URL, return as-is */ }
    }
    return url;
  }
  if (url.startsWith('/')) {
    return `${effectiveOrigin}${url}`;
  }
  return url;
}

/** Map a Better Auth user object to our User interface */
function toUser(raw: any): User {
  return {
    id: raw.id,
    email: raw.email,
    full_name: raw.name ?? raw.full_name,
    name: raw.name,
    image: resolveImageUrl(raw.image),
    email_verified: raw.emailVerified ?? false,
    created_at: raw.createdAt ?? new Date().toISOString(),
    updated_at: raw.updatedAt ?? new Date().toISOString(),
  };
}

// ── Auth actions ──────────────────────────────────────────────────────

export const signIn = async (
  email: string,
  password: string,
): Promise<{ data: AuthResponse | null; error: AuthError | null }> => {
  const { data, error } = await authClient.signIn.email({ email, password });

  if (error) {
    await operationsLog.log({ category: 'AUTH', action: 'SIGN_IN', result: 'failure', target: 'User', errorMessage: error.message ?? 'Sign-in failed' });
    return {
      data: null,
      error: { message: error.message ?? "Sign-in failed", details: [] },
    };
  }

  const user = toUser(data!.user);
  const session: Session = {
    access_token: data!.token ?? "",
    refresh_token: "",
    expires_in: 60 * 60 * 24 * 7,
  };

  notifyListeners("SIGNED_IN", { user, session });
  await operationsLog.log({ category: 'AUTH', action: 'SIGN_IN', result: 'success', target: 'User', targetId: user.id });
  return { data: { user, session }, error: null };
};

export const signUp = async (
  email: string,
  password: string,
  name: string,
): Promise<{ data: AuthResponse | null; error: AuthError | null }> => {
  const { data, error } = await authClient.signUp.email({
    email,
    password,
    name,
  });

  if (error) {
    const message =
      error.message ?? "Registration failed";
    await operationsLog.log({ category: 'AUTH', action: 'SIGN_UP', result: 'failure', target: 'User', errorMessage: message });
    return { data: null, error: { message, details: [] } };
  }

  const user = toUser(data!.user);
  const session: Session = {
    access_token: data!.token ?? "",
    refresh_token: "",
    expires_in: 60 * 60 * 24 * 7,
  };

  notifyListeners("SIGNED_IN", { user, session });
  await operationsLog.log({ category: 'AUTH', action: 'SIGN_UP', result: 'success', target: 'User', targetId: user.id });
  return { data: { user, session }, error: null };
};

export const signInWithGoogle = async () => {
  if (Capacitor.isNativePlatform()) {
    return socialSignInNative("google");
  }
  const { data, error } = await authClient.signIn.social({
    provider: "google",
    callbackURL: `${window.location.origin}/dashboard`,
  });
  if (error) {
    await operationsLog.log({ category: 'AUTH', action: 'SIGN_IN', result: 'failure', target: 'Google', errorMessage: error.message ?? 'Google sign-in failed' });
    return { data: null, error: { message: error.message ?? "Google sign-in failed" } };
  }
  await operationsLog.log({ category: 'AUTH', action: 'SIGN_IN', result: 'success', target: 'Google' });
  return { data, error: null };
};

export const signInWithGithub = async () => {
  // GitHub has no native Capacitor SDK — always use web redirect flow
  const { data, error } = await authClient.signIn.social({
    provider: "github",
    callbackURL: `${window.location.origin}/dashboard`,
  });
  if (error) {
    await operationsLog.log({ category: 'AUTH', action: 'SIGN_IN', result: 'failure', target: 'GitHub', errorMessage: error.message ?? 'GitHub sign-in failed' });
    return { data: null, error: { message: error.message ?? "GitHub sign-in failed" } };
  }
  await operationsLog.log({ category: 'AUTH', action: 'SIGN_IN', result: 'success', target: 'GitHub' });
  return { data, error: null };
};

/**
 * On native (Capacitor), use the native Google Sign-In SDK to get an ID token,
 * then pass it to Better Auth's signIn.social with the idToken parameter.
 * No redirect, no tunnel needed — the native SDK handles Google auth natively.
 *
 * Uses authClient.signIn.social() so cookies are set on the same domain as
 * subsequent getSession() calls — avoids cross-origin cookie issues.
 */
async function socialSignInNative(provider: "google") {
  try {
    const res = await SocialLogin.login({
      provider,
      options: { scopes: ["email", "profile"] },
    });

    if (res.provider !== "google" || res.result.responseType !== "online") {
      return { data: null, error: { message: "Unexpected response from Google Sign-In" } };
    }

    const googleResult = res.result;
    if (!googleResult.idToken) {
      return { data: null, error: { message: "No ID token received from Google" } };
    }

    // Use authClient so the request goes through the same HTTP layer and
    // domain as getSession(), ensuring cookies are stored consistently.
    const { data, error } = await authClient.signIn.social({
      provider,
      idToken: {
        token: googleResult.idToken,
        accessToken: googleResult.accessToken?.token,
      },
      callbackURL: "/dashboard",
    });

    if (error) {
      await operationsLog.log({ category: 'AUTH', action: 'SIGN_IN', result: 'failure', target: `Native ${provider}`, errorMessage: error.message ?? 'Sign-in failed' });
      return { data: null, error: { message: error.message ?? "Sign-in failed" } };
    }

    if (data && 'user' in data && data.user) {
      const user = toUser(data.user);
      const session: Session = {
        access_token: ('token' in data ? data.token : '') ?? "",
        refresh_token: "",
        expires_in: 60 * 60 * 24 * 7,
      };
      notifyListeners("SIGNED_IN", { user, session });
      await operationsLog.log({ category: 'AUTH', action: 'SIGN_IN', result: 'success', target: `Native ${provider}`, targetId: user.id });
      return { data: { user, session }, error: null };
    }

    return { data, error: null };
  } catch (e: any) {
    await operationsLog.log({ category: 'AUTH', action: 'SIGN_IN', result: 'failure', target: `Native ${provider}`, errorMessage: e?.message ?? `Failed to sign in with ${provider}` });
    return {
      data: null,
      error: { message: e?.message ?? `Failed to sign in with ${provider}` },
    };
  }
}

export const signOut = async () => {
  // ── 1. Lock: block the $sessionSignal listener from re-caching ──────
  signingOut = true;

  // ── 2. Synchronous: clear cached user + notify SIGNED_OUT immediately
  // This ensures the UI redirects to login RIGHT AWAY, before any slow
  // async work (like clearDatabase). Even if the user kills the app
  // during cleanup, the cached user is already gone.
  if (typeof window !== 'undefined') {
    localStorage.removeItem('th_cached_user');
    localStorage.removeItem('timeharbor-notepad-notes');
  }
  notifyListeners("SIGNED_OUT", null);

  // ── 3. Stop SyncManager so in-flight requests can't re-establish cookies
  // Dynamic import avoids circular dependency (SyncEngine → auth).
  try {
    const { syncManager } = await import('../SyncManager');
    await syncManager.stop();
  } catch { /* best-effort */ }

  // ── 4. Backend sign-out + cookie clearing BEFORE database wipe ──────
  // These MUST run before clearDatabase() because db.delete() can block
  // when Dexie has active useLiveQuery subscriptions (e.g. recording timer).
  try {
    await authClient.signOut();
  } catch (e) {
    console.error('Backend sign-out request failed:', e);
  }

  if (Capacitor.isNativePlatform()) {
    try {
      await CapacitorCookies.clearAllCookies();
    } catch (e) {
      console.error('Failed to clear native cookies:', e);
    }
  }

  // ── 5. Clear local database (may be slow with active subscriptions) ─
  try {
    await clearDatabase();
    resetTicketState();
  } catch (e) {
    console.error('Failed to clear local database on sign-out:', e);
  }

  // ── 6. Final cookie sweep — catches any late-arriving Set-Cookie ────
  if (Capacitor.isNativePlatform()) {
    try {
      await CapacitorCookies.clearAllCookies();
    } catch { /* best-effort */ }
  }

  try {
    await operationsLog.log({ category: 'AUTH', action: 'SIGN_OUT', result: 'success', target: 'User' });
  } catch { /* Dexie wiped — expected */ }

  // ── 7. Unlock and send a final SIGNED_OUT in case the $sessionSignal
  //    listener snuck a SIGNED_IN through before the flag was set.
  signingOut = false;
  notifyListeners("SIGNED_OUT", null);
  return { error: null };
};

export const getSession = async () => {
  const { data, error } = await authClient.getSession();
  if (error) return { session: null, error };
  if (!data) return { session: null, error: null };

  return {
    session: {
      access_token: data.session?.token ?? "",
      refresh_token: "",
    },
    error: null,
  };
};

export const getUser = async () => {
  console.log('[auth] getUser: calling authClient.getSession()');
  const start = Date.now();
  const { data, error } = await authClient.getSession();
  console.log('[auth] getUser: authClient.getSession() resolved in', Date.now() - start, 'ms', { hasData: !!data, hasError: !!error });
  if (error) return { user: null, error };
  if (!data?.user) return { user: null, error: null };
  const user = toUser(data.user);
  // Keep currentUserId in sync so $sessionSignal can distinguish
  // profile updates from genuine sign-ins (cold start sets this).
  currentUserId = user.id;
  return { user, error: null };
};

/**
 * Fetch session directly via fetch(), bypassing Better Auth's internal
 * session atom. Use this for verifying sessions on Capacitor.
 */
export const getUserDirect = async (): Promise<{ user: User | null; error: any }> => {
  const base = getBackendBase();
  const url = `${base}/api/auth/get-session`;
  console.log('[auth] getUserDirect: fetching', url);
  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'x-app-id': 'timeharbor' },
      credentials: 'include',
    });
    const json = await res.json();
    console.log('[auth] getUserDirect: resolved in', Date.now() - start, 'ms', { status: res.status, hasUser: !!json?.user });
    if (!res.ok || !json?.user) return { user: null, error: null };
    return { user: toUser(json.user), error: null };
  } catch (e) {
    console.log('[auth] getUserDirect: failed in', Date.now() - start, 'ms', e);
    return { user: null, error: e };
  }
};

export const getStoredUser = async (): Promise<User | null> => {
  try {
    const { user } = await getUser();
    if (user) return user;
  } catch {
    // Network call failed (likely offline) — fall through to cache
  }
  // Offline fallback: read from localStorage cache
  try {
    const raw = typeof window !== 'undefined'
      ? localStorage.getItem('th_cached_user')
      : null;
    if (raw) {
      const cached = JSON.parse(raw);
      return cached ? toUser(cached) : null;
    }
  } catch { /* parse error */ }
  return null;
};

export interface ThProfile {
  displayName?: string;
  avatarUrl?: string;
  githubUrl?: string;
  linkedinUrl?: string;
  redmineUrl?: string;
}

function getBackendBase(): string {
  // In Capacitor prod builds, NEXT_PUBLIC_BETTER_AUTH_URL points to the real backend.
  // window.location.origin would be capacitor://localhost which won't work.
  if (process.env.NEXT_PUBLIC_BETTER_AUTH_URL) return process.env.NEXT_PUBLIC_BETTER_AUTH_URL;
  if (typeof window !== 'undefined') return `${window.location.origin}`;
  return 'http://localhost:3001';
}

/** Fetch a server avatar image and cache it as base64 in Dexie for offline use */
async function cacheAvatarAsBase64(avatarUrl: string): Promise<void> {
  if (!avatarUrl || avatarUrl.startsWith('data:')) return;
  const resolved = avatarUrl.startsWith('/')
    ? `${getBackendBase()}${avatarUrl}`
    : avatarUrl;
  const res = await fetch(resolved, { credentials: 'include' });
  if (!res.ok) return;
  const blob = await res.blob();
  const reader = new FileReader();
  const dataUrl = await new Promise<string>((resolve, reject) => {
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
  await db.profile.put({ key: 'avatarDataUrl', data: dataUrl });
}

export const fetchProfile = async (): Promise<{ profile: ThProfile | null; error: { message: string } | null }> => {
  // Always check Dexie for a pending local avatar first
  let localAvatar: string | null = null;
  try {
    const localEntry = await db.profile.get('avatarDataUrl');
    if (localEntry?.data) localAvatar = localEntry.data;
  } catch { /* Dexie unavailable */ }

  // Helper: update auth context with the best available avatar so header/sidebar show it
  const applyAvatarToContext = async (avatar: string | null) => {
    if (!avatar) return;
    try {
      const effectiveOrigin =
        process.env.NEXT_PUBLIC_BETTER_AUTH_URL
        || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3001');
      const resolved = avatar.startsWith('/')
        ? `${effectiveOrigin}${avatar}` : avatar;
      const user = await getStoredUser();
      // Only notify if the image actually changed (user.image is already resolved by toUser)
      if (user && user.image !== resolved) {
        notifyListeners('USER_UPDATED', { user: { ...user, image: resolved } });
      }
    } catch { /* ignore */ }
  };

  try {
    const res = await fetch(`${getBackendBase()}/api/timeharbor/me/th-profile`, {
      credentials: 'include',
      headers: { 'X-App-Id': 'timeharbor' },
    });
    if (!res.ok) {
      // Offline or error — return local data if available
      const cachedProfile = await db.profile.get('thProfile').catch(() => null);
      const profile = cachedProfile?.data ?? null;
      if (profile && localAvatar) profile.avatarDataUrl = localAvatar;
      // Prefer cached base64 avatar for offline display
      const offlineAvatar = localAvatar || (await db.profile.get('avatarDataUrl').catch(() => null))?.data || profile?.avatarUrl;
      await applyAvatarToContext(offlineAvatar);
      return { profile, error: null };
    }
    const { profile } = await res.json();
    // Cache profile locally for offline access
    if (profile) {
      await db.profile.put({ key: 'thProfile', data: profile }).catch(() => {});
    }
    // Overlay pending local avatar if we have one
    if (profile && localAvatar) {
      profile.avatarDataUrl = localAvatar;
      await applyAvatarToContext(localAvatar);
    } else if (profile?.avatarUrl) {
      // Backend has an avatar (e.g. uploaded from another device) — apply it
      await applyAvatarToContext(profile.avatarUrl);
      // Proactively cache avatar as base64 for offline use
      cacheAvatarAsBase64(profile.avatarUrl).catch(() => {});
    }
    return { profile, error: null };
  } catch (e: any) {
    // Network error — return cached profile
    const cachedProfile = await db.profile.get('thProfile').catch(() => null);
    const profile = cachedProfile?.data ?? null;
    if (profile && localAvatar) profile.avatarDataUrl = localAvatar;
    // Prefer cached base64 avatar for offline display
    const offlineAvatar = localAvatar || (await db.profile.get('avatarDataUrl').catch(() => null))?.data || profile?.avatarUrl;
    await applyAvatarToContext(offlineAvatar);
    return { profile: profile ?? null, error: null };
  }
};

export const updateProfile = async (data: {
  full_name?: string;
  email?: string;
  github_url?: string;
  linkedin_url?: string;
  redmine_url?: string;
}) => {
  // Build payloads
  const updatePayload: Record<string, string> = {};
  if (data.full_name) updatePayload.name = data.full_name;

  const profilePayload: Record<string, string> = {};
  if (data.full_name) profilePayload.displayName = data.full_name;
  if (data.github_url !== undefined) profilePayload.githubUrl = data.github_url;
  if (data.linkedin_url !== undefined) profilePayload.linkedinUrl = data.linkedin_url;
  if (data.redmine_url !== undefined) profilePayload.redmineUrl = data.redmine_url;

  try {
    // 1. Update Better Auth user (name) — network call
    if (Object.keys(updatePayload).length > 0) {
      const { error } = await authClient.updateUser(updatePayload);
      if (error) {
        return { user: null, error: { message: error.message ?? 'Update failed' } };
      }
    }

    // 2. Update Timeharbor profile (linked accounts + displayName) — network call
    if (Object.keys(profilePayload).length > 0) {
      const res = await fetch(`${getBackendBase()}/api/timeharbor/me/th-profile`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-App-Id': 'timeharbor' },
        body: JSON.stringify(profilePayload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return { user: null, error: { message: err.error ?? `Profile update failed (${res.status})` } };
      }
    }

    // 3. Refresh user from session & notify listeners
    const { user } = await getUser();
    notifyListeners('USER_UPDATED', { user });
    await operationsLog.log({ category: 'PROFILE', action: 'UPDATE', result: 'success', target: 'Profile', details: { fields: Object.keys(data) } });
    return { user, error: null };
  } catch {
    // Offline — save changes locally for later sync
    // Update cached profile in Dexie
    const cachedProfile = await db.profile.get('thProfile').catch(() => null);
    const existing = cachedProfile?.data ?? {};
    const merged = { ...existing, ...profilePayload };
    await db.profile.put({ key: 'thProfile', data: merged }).catch(() => {});

    // Queue the pending profile update for sync
    await db.profile.put({ key: 'pendingProfileUpdate', data: { ...data, updatedAt: new Date().toISOString() } }).catch(() => {});

    // Update cached user in localStorage so UI reflects changes immediately
    const cachedUser = await getStoredUser();
    if (cachedUser && data.full_name) {
      const updatedUser = { ...cachedUser, full_name: data.full_name, name: data.full_name };
      notifyListeners('USER_UPDATED', { user: updatedUser });
      try {
        localStorage.setItem('th_cached_user', JSON.stringify(updatedUser));
      } catch { /* quota */ }
    }

    await operationsLog.log({ category: 'PROFILE', action: 'UPDATE', result: 'success', target: 'Profile', details: { fields: Object.keys(data), offline: true } });
    return { user: cachedUser, error: null };
  }
};

export const uploadAvatar = async (file: File): Promise<{ avatarUrl: string | null; error: { message: string } | null }> => {
  // Convert to base64 for local storage
  const dataUrl = await fileToDataUrl(file);

  try {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${getBackendBase()}/api/timeharbor/me/avatar`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'X-App-Id': 'timeharbor' },
      body: formData,
    });
    if (!res.ok) {
      throw new Error(`Upload failed (${res.status})`);
    }
    const { avatarUrl } = await res.json();

    // Clear pending local avatar since server has it now
    await db.profile.delete('avatarDataUrl').catch(() => {});
    await db.profile.delete('pendingAvatarFile').catch(() => {});

    // Store relative path in Better Auth so it works from any device/origin
    await authClient.updateUser({ image: avatarUrl });
    const { user } = await getUser();
    notifyListeners('USER_UPDATED', { user });

    await operationsLog.log({ category: 'PROFILE', action: 'UPLOAD', result: 'success', target: 'Avatar' });
    return { avatarUrl, error: null };
  } catch {
    await operationsLog.log({ category: 'PROFILE', action: 'UPLOAD', result: 'failure', target: 'Avatar', errorMessage: 'Upload failed — saved offline' });
    // Offline — save to Dexie for later sync
    await db.profile.put({ key: 'avatarDataUrl', data: dataUrl }).catch(() => {});
    // Store file data for syncing later
    await db.profile.put({ key: 'pendingAvatarFile', data: { name: file.name, type: file.type, dataUrl } }).catch(() => {});

    // Update auth context so header avatar reflects the change immediately
    try {
      const { user } = await getUser();
      if (user) notifyListeners('USER_UPDATED', { user: { ...user, image: dataUrl } });
    } catch { /* ignore */ }

    return { avatarUrl: dataUrl, error: null };
  }
};

export const deleteAvatar = async (): Promise<{ error: { message: string } | null }> => {
  // Clear local avatar immediately
  await db.profile.delete('avatarDataUrl').catch(() => {});
  await db.profile.delete('pendingAvatarFile').catch(() => {});

  try {
    const res = await fetch(`${getBackendBase()}/api/timeharbor/me/avatar`, {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'X-App-Id': 'timeharbor' },
    });
    if (!res.ok) {
      throw new Error(`Delete failed (${res.status})`);
    }

    // Clear Better Auth user.image
    await authClient.updateUser({ image: '' });
    const { user } = await getUser();
    notifyListeners('USER_UPDATED', { user });

    await operationsLog.log({ category: 'PROFILE', action: 'DELETE', result: 'success', target: 'Avatar' });
    return { error: null };
  } catch {
    await operationsLog.log({ category: 'PROFILE', action: 'DELETE', result: 'failure', target: 'Avatar', errorMessage: 'Delete failed — queued offline' });
    // Offline — mark for deletion on next sync
    await db.profile.put({ key: 'pendingAvatarDelete', data: true }).catch(() => {});

    // Update auth context so header avatar clears immediately
    try {
      const { user } = await getUser();
      if (user) notifyListeners('USER_UPDATED', { user: { ...user, image: undefined } });
    } catch { /* ignore */ }

    return { error: null };
  }
};

/** Sync any pending avatar changes when connectivity is restored */
export const syncPendingAvatar = async (): Promise<void> => {
  // Check for pending delete
  const pendingDelete = await db.profile.get('pendingAvatarDelete').catch(() => null);
  if (pendingDelete?.data) {
    try {
      const res = await fetch(`${getBackendBase()}/api/timeharbor/me/avatar`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'X-App-Id': 'timeharbor' },
      });
      if (res.ok) {
        await db.profile.delete('pendingAvatarDelete').catch(() => {});
        await authClient.updateUser({ image: '' });
        const { user } = await getUser();
        notifyListeners('USER_UPDATED', { user });
      }
    } catch { /* Will retry next sync */ }
    return;
  }

  // Check for pending upload
  const pendingFile = await db.profile.get('pendingAvatarFile').catch(() => null);
  if (!pendingFile?.data) return;

  try {
    const { name, type, dataUrl } = pendingFile.data;
    const blob = dataUrlToBlob(dataUrl);
    const file = new File([blob], name, { type });

    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${getBackendBase()}/api/timeharbor/me/avatar`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'X-App-Id': 'timeharbor' },
      body: formData,
    });
    if (!res.ok) return; // Will retry next sync

    const { avatarUrl } = await res.json();

    // Clean up local pending state
    await db.profile.delete('avatarDataUrl').catch(() => {});
    await db.profile.delete('pendingAvatarFile').catch(() => {});

    await authClient.updateUser({ image: avatarUrl });
    const { user } = await getUser();
    notifyListeners('USER_UPDATED', { user });
  } catch { /* Will retry next sync */ }
};

/** Sync any pending profile updates when connectivity is restored */
export const syncPendingProfile = async (): Promise<void> => {
  const pending = await db.profile.get('pendingProfileUpdate').catch(() => null);
  if (!pending?.data) return;

  const data = pending.data;
  try {
    // 1. Update Better Auth user (name)
    if (data.full_name) {
      const { error } = await authClient.updateUser({ name: data.full_name });
      if (error) return; // Will retry next sync
    }

    // 2. Update Timeharbor profile
    const profilePayload: Record<string, string> = {};
    if (data.full_name) profilePayload.displayName = data.full_name;
    if (data.github_url !== undefined) profilePayload.githubUrl = data.github_url;
    if (data.linkedin_url !== undefined) profilePayload.linkedinUrl = data.linkedin_url;
    if (data.redmine_url !== undefined) profilePayload.redmineUrl = data.redmine_url;

    if (Object.keys(profilePayload).length > 0) {
      const res = await fetch(`${getBackendBase()}/api/timeharbor/me/th-profile`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-App-Id': 'timeharbor' },
        body: JSON.stringify(profilePayload),
      });
      if (!res.ok) return; // Will retry next sync
    }

    // Success — clear the pending update
    await db.profile.delete('pendingProfileUpdate').catch(() => {});

    // Refresh user
    const { user } = await getUser();
    notifyListeners('USER_UPDATED', { user });
  } catch { /* Will retry next sync */ }
};

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export const forgotPassword = async (email: string) => {
  // The Better Auth Proxy client maps `requestPasswordReset` →
  // POST /request-password-reset. We cast because the types aren't always
  // generated for this endpoint unless the server advertises sendResetPassword.
  const client = authClient as any;

  // Build an absolute redirectTo URL so the reset email link redirects
  // to the frontend (not the backend's BETTER_AUTH_URL).
  const redirectTo =
    typeof window !== "undefined"
      ? `${window.location.origin}/reset-password`
      : "/reset-password";

  try {
    const { error } = await client.requestPasswordReset({
      email,
      redirectTo,
    });

    if (error) {
      return { data: null, error: { message: error.message ?? "Failed to send reset email" } };
    }
  } catch (e: any) {
    return { data: null, error: { message: e?.message ?? "Failed to send reset email" } };
  }
  return { data: { success: true }, error: null };
};

export const resetPassword = async (token: string, password: string) => {
  const { error } = await authClient.resetPassword({
    token,
    newPassword: password,
  });

  if (error) {
    return { data: null, error: { message: error.message ?? "Password reset failed" } };
  }
  return { data: { success: true }, error: null };
};

export const clearStoredSession = async () => {
  await authClient.signOut();
};

export const refreshAccessToken = async (): Promise<{
  data: Session | null;
  error: AuthError | null;
}> => {
  // Better Auth handles session refresh via cookie automatically.
  // This function exists for interface compatibility.
  const { data } = await authClient.getSession();
  if (!data) return { data: null, error: { message: "No active session" } };
  return {
    data: {
      access_token: data.session?.token ?? "",
      refresh_token: "",
      expires_in: 60 * 60 * 24 * 7,
    },
    error: null,
  };
};

export const authenticatedFetch = async (
  url: string,
  options: RequestInit = {},
): Promise<Response> => {
  // Better Auth cookies are sent automatically by the browser.
  return fetch(url, { ...options, credentials: "include" });
};

export const onAuthStateChange = (callback: AuthListener) => {
  listeners.push(callback);

  // Subscribe to Better Auth's reactive session store for external changes
  // (e.g. session invalidated in another tab via BroadcastChannel)
  const sessionAtom = authClient.$store.atoms["$sessionSignal"];
  let unsub: (() => void) | undefined;
  if (sessionAtom?.listen) {
    unsub = sessionAtom.listen(async () => {
      // Skip if a sign-out is in progress — the atom change is from
      // authClient.signOut() and we must NOT re-cache the user.
      if (signingOut) return;
      const { data } = await authClient.getSession();
      if (data?.user) {
        const user = toUser(data.user);
        // Same user → session refresh or profile update (e.g. avatar upload).
        // Different/new user → genuine sign-in from another tab.
        const event = currentUserId && currentUserId === user.id ? 'USER_UPDATED' : 'SIGNED_IN';
        callback(event, { user, session: data.session });
      }
    });
  }

  return {
    unsubscribe: () => {
      const index = listeners.indexOf(callback);
      if (index > -1) listeners.splice(index, 1);
      unsub?.();
    },
  };
};
