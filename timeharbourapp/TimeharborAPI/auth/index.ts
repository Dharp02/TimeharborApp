// API URL from environment variable
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
import { db } from '../db';

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

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined';

// Token storage helpers
const setTokens = (session: Session) => {
  if (!isBrowser) return;
  localStorage.setItem('access_token', session.access_token);
  localStorage.setItem('refresh_token', session.refresh_token);
  localStorage.setItem('token_expires_at', String(Date.now() + session.expires_in * 1000));
};

const setUser = async (user: User) => {
  if (!isBrowser) return;
  try {
    await db.profile.put({ key: 'user', data: user });
  } catch (error) {
    console.error('Failed to save user to Dexie:', error);
  }
};

export const getStoredUser = async (): Promise<User | null> => {
  if (!isBrowser) return null;
  try {
    const record = await db.profile.get('user');
    return record ? record.data : null;
  } catch (error) {
    console.error('Failed to get user from Dexie:', error);
    return null;
  }
};

const clearTokens = async () => {
  if (!isBrowser) return;
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('token_expires_at');
  try {
    await db.profile.delete('user');
  } catch (error) {
    console.error('Failed to delete user from Dexie:', error);
  }
};

const getAccessToken = (): string | null => {
  if (!isBrowser) return null;
  return localStorage.getItem('access_token');
};

const getRefreshToken = (): string | null => {
  if (!isBrowser) return null;
  return localStorage.getItem('refresh_token');
};

const isTokenExpired = (): boolean => {
  if (!isBrowser) return true;
  const expiresAt = localStorage.getItem('token_expires_at');
  if (!expiresAt) return true;
  
  // Check if token expires in the next 30 seconds
  return Date.now() >= (parseInt(expiresAt) - 30000);
};

let refreshPromise: Promise<{ data: Session | null; error: AuthError | null }> | null = null;

// Refresh token function
export const refreshAccessToken = async (): Promise<{ data: Session | null; error: AuthError | null }> => {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    const refreshToken = getRefreshToken();
    
    if (!refreshToken) {
      return { data: null, error: { message: 'No refresh token available' } };
    }

    try {
      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Only clear tokens if the server explicitly rejected the refresh token (401/403)
        if (response.status === 401 || response.status === 403) {
          await clearTokens();
          notifyListeners('TOKEN_EXPIRED', null);
        }
        return { data: null, error: { message: data.error || 'Token refresh failed' } };
      }

      // Update tokens
      setTokens(data.session);
      
      return { data: data.session, error: null };
    } catch (err) {
      console.error('Token refresh error:', err);
      // Do NOT clear tokens on network error - allow offline mode
      return { data: null, error: { message: 'Network error' } };
    }
  })();

  try {
    const result = await refreshPromise;
    return result;
  } finally {
    refreshPromise = null;
  }
};

// Authenticated fetch wrapper
export const authenticatedFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
  let token = getAccessToken();

  // Check if token is expired and refresh if needed
  if (token && isTokenExpired()) {
    const { data, error } = await refreshAccessToken();
    if (error) {
      throw new Error('Session expired. Please sign in again.');
    }
    token = data?.access_token || null;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return fetch(url, {
    ...options,
    headers,
  });
};

export const signUp = async (email: string, password: string, name: string) => {
  console.log('Signing up with:', { email, name });
  try {
    const response = await fetch(`${API_URL}/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password, full_name: name }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Signup failed:', data);
      return { data: null, error: { message: data.error || 'Signup failed', details: data.details } };
    }

    if (data.session) {
      setTokens(data.session);
      await setUser(data.user);
      notifyListeners('SIGNED_IN', { user: data.user, session: data.session });
    }

    return { data, error: null };
  } catch (err) {
    console.error('Signup error:', err);
    return { data: null, error: { message: 'Network error' } };
  }
};

export const signIn = async (email: string, password: string) => {
  try {
    const response = await fetch(`${API_URL}/auth/signin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { data: null, error: { message: data.error || 'Signin failed', details: data.details } };
    }

    if (data.session) {
      setTokens(data.session);
      await setUser(data.user);
      notifyListeners('SIGNED_IN', { user: data.user, session: data.session });
    }

    return { data, error: null };
  } catch (err) {
    console.error('Signin error:', err);
    return { data: null, error: { message: 'Network error' } };
  }
};

export const signOut = async () => {
  const refreshToken = getRefreshToken();
  
  try {
    // Call signout endpoint to revoke refresh token
    if (refreshToken) {
      await fetch(`${API_URL}/auth/signout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
    }
  } catch (err) {
    console.error('Signout error:', err);
  } finally {
    await clearTokens();
    notifyListeners('SIGNED_OUT', null);
  }
  
  return { error: null };
};

export const getSession = async () => {
  if (!isBrowser) {
    return { session: null, error: null };
  }
  
  const token = getAccessToken();
  const refreshToken = getRefreshToken();
  
  if (!token || !refreshToken) {
    return { session: null, error: null };
  }

  // Check if token is expired
  if (isTokenExpired()) {
    const { data, error } = await refreshAccessToken();
    if (error) {
      return { session: null, error };
    }
    return { 
      session: { 
        access_token: data?.access_token || '',
        refresh_token: data?.refresh_token || ''
      }, 
      error: null 
    };
  }

  return { 
    session: { 
      access_token: token,
      refresh_token: refreshToken
    }, 
    error: null 
  };
};

export const getUser = async () => {
  if (!isBrowser) {
    return { user: null, error: null };
  }

  // Check if we have tokens. If not, don't attempt to fetch user.
  // This prevents 401 errors on the login page or for unauthenticated users.
  const token = getAccessToken();
  const refreshToken = getRefreshToken();
  
  if (!token && !refreshToken) {
    return { user: null, error: null };
  }
  
  // Try to return stored user immediately for better UX
  const storedUser = await getStoredUser();
  
  try {
    // Use a timeout for the network request to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(new Error('Request timed out')), 10000); // 10 second timeout

    const response = await authenticatedFetch(`${API_URL}/auth/me`, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const data = await response.json();

    if (!response.ok) {
      // If unauthorized, try to refresh token
      if (response.status === 401) {
        const { error } = await refreshAccessToken();
        if (error) {
          return { user: null, error: { message: 'Session expired' } };
        }
        
        // Retry with new token
        const retryResponse = await authenticatedFetch(`${API_URL}/auth/me`);
        const retryData = await retryResponse.json();
        
        if (!retryResponse.ok) {
          return { user: null, error: { message: retryData.error } };
        }
        
        await setUser(retryData.user);
        return { user: retryData.user, error: null };
      }
      
      // If we have a stored user but the server request failed (non-401), 
      // we might want to return the stored user anyway if it's a temporary server issue
      if (storedUser) {
        return { user: storedUser, error: null };
      }

      return { user: null, error: { message: data.error || 'Failed to fetch user' } };
    }

    await setUser(data.user);
    return { user: data.user, error: null };
  } catch (err: any) {
    // Don't log session expired errors
    if (err?.message !== 'Session expired. Please sign in again.') {
      console.error('Get user error:', err);
    }
    
    // If network error or timeout, return stored user
    if (storedUser) {
      return { user: storedUser, error: null };
    }

    const message = err?.message === 'Session expired. Please sign in again.' 
      ? 'Session expired' 
      : 'Network error';
      
    return { user: null, error: { message } };
  }
};

export const updateProfile = async (data: { full_name?: string; email?: string }) => {
  try {
    const response = await authenticatedFetch(`${API_URL}/auth/me`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    const responseData = await response.json();

    if (!response.ok) {
      return { user: null, error: { message: responseData.error || 'Failed to update profile' } };
    }

    // Update local storage/db with new user data
    if (responseData.user) {
        await setUser(responseData.user);
    }

    return { user: responseData.user, error: null };
  } catch (err: any) {
    console.error('Update profile error:', err);
    return { user: null, error: { message: err.message || 'Network error' } };
  }
};

export const forgotPassword = async (email: string) => {
  try {
    const response = await fetch(`${API_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { data: null, error: { message: data.error || 'Failed to send reset email' } };
    }

    return { data, error: null };
  } catch (err) {
    console.error('Forgot password error:', err);
    return { data: null, error: { message: 'Network error' } };
  }
};

export const resetPassword = async (token: string, password: string) => {
  try {
    const response = await fetch(`${API_URL}/auth/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { data: null, error: { message: data.error || 'Password reset failed' } };
    }

    return { data, error: null };
  } catch (err) {
    console.error('Reset password error:', err);
    return { data: null, error: { message: 'Network error' } };
  }
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
