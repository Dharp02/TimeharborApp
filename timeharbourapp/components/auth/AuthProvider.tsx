'use client';

import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { auth } from '@/TimeharborAPI';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { SocialLogin } from '@capgo/capacitor-social-login';

type AuthContextType = {
  user: any | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType>({ user: null, loading: true });

export const useAuth = () => useContext(AuthContext);

const CACHED_USER_KEY = 'th_cached_user';

/** Persist user to localStorage so cold start is instant. */
function cacheUser(u: any | null) {
  try {
    if (u) {
      localStorage.setItem(CACHED_USER_KEY, JSON.stringify(u));
    } else {
      localStorage.removeItem(CACHED_USER_KEY);
    }
  } catch { /* quota / SSR */ }
}

/** Read cached user from localStorage (returns null if none). */
function getCachedUser(): any | null {
  try {
    const raw = localStorage.getItem(CACHED_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  // Hydrate immediately from cache — no loading screen if we have a cached user.
  const cached = typeof window !== 'undefined' ? getCachedUser() : null;
  const [user, setUser] = useState<any | null>(cached);
  const [loading, setLoading] = useState(cached === null);
  const initRef = useRef(false);
  const router = useRouter();
  const pathname = usePathname();

  // Capacitor listener handles for synchronous cleanup.
  const urlOpenHandle = useRef<Awaited<ReturnType<typeof App.addListener>> | null>(null);
  const stateChangeHandle = useRef<Awaited<ReturnType<typeof App.addListener>> | null>(null);

  // ── Wrapper: set user + persist to cache ─────────────────────────────
  const setUserAndCache = useCallback((u: any | null) => {
    setUser(u);
    cacheUser(u);
  }, []);

  // ── Fetch session and update state ───────────────────────────────────
  const refreshSession = useCallback(async () => {
    const { user: u } = await auth.getUser();
    setUserAndCache(u ?? null);
    setLoading(false);
    return u ?? null;
  }, [setUserAndCache]);

  // ── On mount: init plugins, verify session in background ─────────────
  useEffect(() => {
    if (!initRef.current) {
      initRef.current = true;
      if (Capacitor.isNativePlatform()) {
        SocialLogin.initialize({
          google: {
            iOSClientId: process.env.NEXT_PUBLIC_GOOGLE_IOS_CLIENT_ID || '',
            iOSServerClientId: process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID || '',
          },
        }).catch(() => {});
      }
    }

    let cancelled = false;

    (async () => {
      const hasCached = getCachedUser() !== null;
      console.log('[AuthProvider] cold start', { hasCachedUser: hasCached });

      // If we have a cached user, we're already showing the dashboard.
      // Set loading=false immediately so the app is usable right away.
      if (hasCached) {
        setLoading(false);
      }

      // Timeout: if auth.getUser() hangs, force loading=false after 5s.
      const timeout = setTimeout(() => {
        if (!cancelled) {
          console.log('[AuthProvider] session check timed out, forcing loading=false');
          setLoading(false);
        }
      }, 5000);

      // Verify with backend (may hang on cold start — that's OK if we have cache).
      const { user: u, error } = await auth.getUser();
      clearTimeout(timeout);
      if (cancelled) return;

      if (error) {
        console.log('[AuthProvider] session check failed (offline?), keeping cache');
        setLoading(false);
        return;
      }

      if (u) {
        console.log('[AuthProvider] session verified', { id: u.id });
        setUserAndCache(u);
        auth.fetchProfile().catch(() => {});
      } else {
        console.log('[AuthProvider] no session, clearing cache');
        setUserAndCache(null);
      }
      setLoading(false);
    })();

    const subscription = auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') {
        setUserAndCache(session?.user ?? null);
      } else if (event === 'SIGNED_OUT') {
        setUserAndCache(null);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Deep-link callback from OAuth on native ──────────────────────────
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    urlOpenHandle.current?.remove();

    App.addListener('appUrlOpen', async ({ url }) => {
      if (url.startsWith('timeharbor://auth/callback')) {
        await Browser.close().catch(() => {});
        const u = await refreshSession();
        if (u) {
          setLoading(false);
          router.replace('/dashboard');
        }
      }
    }).then((h) => { urlOpenHandle.current = h; });

    return () => { urlOpenHandle.current?.remove(); urlOpenHandle.current = null; };
  }, [router, refreshSession]);

  // ── Re-validate session when app resumes from background ─────────────
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    stateChangeHandle.current?.remove();

    App.addListener('appStateChange', async ({ isActive }) => {
      if (!isActive) return;
      console.log('[AuthProvider] app resumed, refreshing session');
      await refreshSession();
    }).then((h) => { stateChangeHandle.current = h; });

    return () => { stateChangeHandle.current?.remove(); stateChangeHandle.current = null; };
  }, [refreshSession]);

  // ── Redirect: only after loading is done ─────────────────────────────
  useEffect(() => {
    if (loading) return;

    const p = pathname === '/' ? '/' : pathname?.replace(/\/$/, '') || '';
    const isAuthPage = ['/login', '/signup', '/forgot-password', '/'].includes(p);
    const isDashboard = p.startsWith('/dashboard');

    console.log('[AuthProvider] routing', { user: !!user, path: p });

    if (user && isAuthPage) {
      router.replace('/dashboard');
    } else if (!user && isDashboard) {
      router.replace('/login');
    }
  }, [user, loading, pathname, router]);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
