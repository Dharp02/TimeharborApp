import { db } from '../db';
import { mockUser } from '../mockData';

// Types
export interface User {
  id: string;
  email: string;
  full_name?: string;
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

const notifyListeners = (event: string, session: any) => {
  listeners.forEach(listener => listener(event, session));
};

const isBrowser = typeof window !== 'undefined';

const setUser = async (user: User) => {
  if (!isBrowser) return;
  localStorage.setItem('mock_user', JSON.stringify(user));
  try {
    await db.profile.put({ key: 'user', data: user });
  } catch (error) {
    console.error('Failed to save user to Dexie:', error);
  }
};

export const getStoredUser = async (): Promise<User | null> => {
  if (!isBrowser) return null;
  const stored = localStorage.getItem('mock_user');
  if (stored) {
    try { return JSON.parse(stored); } catch { /* fall through */ }
  }
  try {
    const record = await db.profile.get('user');
    return record ? record.data : null;
  } catch {
    return null;
  }
};

const clearSession = async () => {
  if (!isBrowser) return;
  localStorage.removeItem('mock_user');
  try {
    await Promise.all(db.tables.map(table => table.clear()));
  } catch (error) {
    console.error('Failed to clear Dexie cache on sign-out:', error);
  }
};

export const clearStoredSession = clearSession;

export const refreshAccessToken = async (): Promise<{ data: Session | null; error: AuthError | null }> => {
  return { data: { access_token: 'mock-token', refresh_token: 'mock-refresh', expires_in: 86400 }, error: null };
};

export const authenticatedFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
  return fetch(url, { ...options });
};

export const signUp = async (_email: string, _password: string, _name: string) => {
  return { data: null, error: { message: 'Registration is not available in demo mode' } as AuthError };
};

export const signIn = async (email: string, password: string) => {
  if (email === 'admin' && password === 'admin') {
    const user = { ...mockUser };
    await setUser(user);
    notifyListeners('SIGNED_IN', { user, session: { access_token: 'mock-token', refresh_token: 'mock-refresh' } });
    return { data: { user, session: { access_token: 'mock-token', refresh_token: 'mock-refresh', expires_in: 86400 } }, error: null as AuthError | null };
  }
  return { data: null, error: { message: 'Invalid credentials. Use admin / admin' } as AuthError };
};

export const signOut = async () => {
  await clearSession();
  notifyListeners('SIGNED_OUT', null);
  return { error: null };
};

export const getSession = async () => {
  if (!isBrowser) return { session: null, error: null };
  const user = await getStoredUser();
  if (!user) return { session: null, error: null };
  return { session: { access_token: 'mock-token', refresh_token: 'mock-refresh' }, error: null };
};

export const getUser = async () => {
  if (!isBrowser) return { user: null, error: null };
  const user = await getStoredUser();
  return { user: user || null, error: null };
};

export const updateProfile = async (data: { full_name?: string; email?: string; github_url?: string; linkedin_url?: string; redmine_url?: string }) => {
  const user = await getStoredUser();
  if (!user) return { user: null, error: { message: 'Not signed in' } };
  const updated = { ...user, ...data, updated_at: new Date().toISOString() };
  await setUser(updated);
  return { user: updated, error: null };
};

export const forgotPassword = async (_email: string) => {
  return { data: null, error: { message: 'Password reset is not available in demo mode' } };
};

export const resetPassword = async (_token: string, _password: string) => {
  return { data: null, error: { message: 'Password reset is not available in demo mode' } };
};

export const onAuthStateChange = (callback: AuthListener) => {
  listeners.push(callback);
  return {
    unsubscribe: () => {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  };
};
