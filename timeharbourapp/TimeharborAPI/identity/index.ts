import { db } from '../db';
import { getApiUrl } from '../apiUrl';
import { getIdentityUUID as getSyncIdentityUUID } from '../sync/IdentityManager';

export interface User {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string | null;
  createdAt: Date;
  updatedAt: Date;
  firstName?: string;
  lastName?: string;
}

export interface Session {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface AuthError {
  message: string;
}

export type AuthListener = (
  event: 'SIGNED_IN' | 'SIGNED_OUT' | 'USER_UPDATED' | 'SESSION_UPDATED',
  session: { session: Session | null; user: User | null }
) => void;

export const getIdentityUUID = (): string => {
  return getSyncIdentityUUID();
};

// Simplified Listeners
let _listeners: AuthListener[] = []; if (typeof window !== "undefined") { _listeners = (window as any).__th_auth_listeners = (window as any).__th_auth_listeners || []; } const listeners: AuthListener[] = _listeners;
const notifyListeners = (event: 'SIGNED_IN' | 'SIGNED_OUT' | 'USER_UPDATED' | 'SESSION_UPDATED', session: { session: Session | null; user: User | null }) => {
  listeners.forEach(l => l(event, session));
};

export const onAuthStateChange = (callback: AuthListener) => {
  listeners.push(callback);
  return {
    unsubscribe: () => {
      const index = listeners.indexOf(callback);
      if (index > -1) listeners.splice(index, 1);
    }
  };
};

export const getSession = async (): Promise<{ data: Session | null; error: AuthError | null }> => {
  return {
    data: {
      access_token: getIdentityUUID(),
      refresh_token: '',
      expires_in: Number.MAX_SAFE_INTEGER || 9999999
    },
    error: null
  };
};

export const getUser = async (): Promise<{ user: User | null; error: AuthError | null }> => {
  const uid = getIdentityUUID();
  const profile = await db.userProfiles.get(uid).catch(() => null);
  const name = (profile?.displayName ?? '').trim();
  const email = (profile?.email ?? '').trim();
  const [firstName = '', ...lastNameParts] = name ? name.split(/\s+/) : [];
  const user: User = {
    id: uid,
    email,
    emailVerified: false,
    name,
    image: profile?.avatarBase64 || null,
    createdAt: profile?.createdAt ? new Date(profile.createdAt) : new Date(),
    updatedAt: profile?.updatedAt ? new Date(profile.updatedAt) : new Date(),
    firstName,
    lastName: lastNameParts.join(' ')
  };
  return { user, error: null };
};

export const updateUser = async (updates: Partial<User>): Promise<{ user: User | null; error: AuthError | null }> => {
  const uid = getIdentityUUID();
  const existing = await db.userProfiles.get(uid).catch(() => null);
  if (existing) {
    const patch: any = { updatedAt: new Date().toISOString() };
    if (updates.name !== undefined) patch.displayName = updates.name;
    if (updates.image !== undefined) patch.avatarBase64 = updates.image;
    await db.userProfiles.update(uid, patch).catch(() => {});
  }
  
  const { user } = await getUser();
  notifyListeners('USER_UPDATED', { session: null, user });
  return { user, error: null };
}

export const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
  const headers = new Headers(options.headers);
  headers.set('X-Identity-UUID', getIdentityUUID());
  headers.set('X-App-Id', 'timeharbor');

  return fetch(`${getApiUrl()}${endpoint}`, {
    ...options,
    headers
  });
};

export const authenticatedFetch = apiFetch;

export const uploadAvatar = async (file: File): Promise<{ success: boolean; error: AuthError | null }> => {
  try {
    const reader = new FileReader();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    await updateUser({ image: dataUrl });
    return { success: true, error: null };
  } catch (e: any) {
    return { success: false, error: { message: e.message || 'Avatar upload failed' } };
  }
};

export const removeAvatar = async (): Promise<{ success: boolean; error: AuthError | null }> => {
  try {
    await updateUser({ image: null });
    return { success: true, error: null };
  } catch (e: any) {
     return { success: false, error: { message: e.message || 'Remove failed' } };
  }
};

export const clearStoredSession = async () => {};
export const refreshAccessToken = getSession;
export const ensureIdentityConsistency = async () => {};
export const syncPendingProfile = async () => {};

export const fetchProfile = async (): Promise<{ profile: any; error: AuthError | null }> => {
  try {
    const res = await apiFetch('/timeharbor/me/th-profile');
    if (res.ok) {
      const data = await res.json();
      return { profile: data, error: null };
    }
  } catch (e: any) {}
  return { profile: null, error: { message: 'Fetch failed' } };
};
