'use client';

import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { identity } from '@/TimeharborAPI';
import { syncManager } from '@/TimeharborAPI/SyncManager';
import { clearDatabase } from '@/TimeharborAPI/db';
import { resetTicketState } from '@/TimeharborAPI/tickets';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';

type AppSessionContextType = {
  user: any | null;
  loading: boolean;
  initialSyncing: boolean;
};

const AppSessionContext = createContext<AppSessionContextType>({ user: null, loading: true, initialSyncing: false });

export const useAppSession = () => useContext(AppSessionContext);

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

export default function AppSessionProvider({ children }: { children: React.ReactNode }) {
  // Hydrate immediately from cache — no loading screen if we have a cached user.
  const cached = typeof window !== 'undefined' ? getCachedUser() : null;
  const [user, setUser] = useState<any | null>(cached);
  const [loading, setLoading] = useState(cached === null);
  const [initialSyncing, setInitialSyncing] = useState(false);
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
    const { user: u, error } = await identity.getUser();

    // If the session check returned an error (network timeout, backend
    // temporarily unreachable, etc.) keep the existing cached user so
    // transient failures don't sign the user out.
    if (error && !u) {
      console.log('[AppSessionProvider] refreshSession: backend error, keeping cached user');
      setLoading(false);
      return user;
    }

    setUserAndCache(u ?? null);
    setLoading(false);
    return u ?? null;
  }, [setUserAndCache, user]);

  // ── On mount: init plugins, verify session in background ─────────────
  useEffect(() => {
    if (!initRef.current) {
      initRef.current = true;
          }

    let cancelled = false;

    (async () => {
      const hasCached = getCachedUser() !== null;
      console.log('[AppSessionProvider] cold start', { hasCachedUser: hasCached });

      // Defence-in-depth: on native cold start with no cached user, proactively
      // clear cookies BEFORE the session check. This covers the edge case where
      // signOut cleared localStorage but the app was killed before native cookies
      // were fully purged (e.g. recording was active and clearDatabase blocked).
      if (!hasCached && Capacitor.isNativePlatform()) {
        try {
          const { CapacitorCookies } = await import('@capacitor/core');
          await CapacitorCookies.clearAllCookies();
          console.log('[AppSessionProvider] no cached user on native — cleared cookies');
        } catch { /* best-effort */ }
      }

      // If we have a cached user, we're already showing the dashboard.
      // Set loading=false immediately so the app is usable right away.
      if (hasCached) {
        setLoading(false);
      }

      // Timeout: if identity.getUser() hangs, force loading=false after 5s.
      // Keep the cached user — if the session is truly expired, the next
      // successful backend check will clear it.
      const timeout = setTimeout(() => {
        if (!cancelled) {
          console.log('[AppSessionProvider] session check timed out, keeping cached user');
          setLoading(false);
        }
      }, 5000);

      // Verify with backend (may hang on cold start — that's OK if we have cache).
      const { user: u, error } = await identity.getUser();
      clearTimeout(timeout);
      if (cancelled) return;

      if (error) {
        // Backend returned an error (network failure, 500, timeout, etc.)
        // Keep the cached user — transient errors shouldn't sign the user out.
        // If the session is truly expired, `data` will be null with NO error
        // on the next successful check, which is handled below.
        console.log('[AppSessionProvider] session check error, keeping cached user', { error });
        setLoading(false);
        return;
      }

      if (u) {
        console.log('[AppSessionProvider] session verified', { id: u.id });
        setUserAndCache(u);
        // Load profile into Dexie userProfiles if not already seeded
        import('@/TimeharborAPI/profile').then(async ({ getProfile, upsertProfile }) => {
          const local = await getProfile();
          if (!local) {
            // First device bootstrap: fetch from server and seed Dexie
            const { profile } = await identity.fetchProfile();
            if (profile) {
              await upsertProfile({
                displayName: profile.displayName,
                githubUrl: profile.githubUrl,
                linkedinUrl: profile.linkedinUrl,
                redmineUrl: profile.redmineUrl,
              });
            }
          }
        }).catch(() => {});
      } else if (!hasCached) {
        // Only clear if there was no cached user to begin with.
        // If the user had a cached session, keep them signed in —
        // they should only be signed out when they press "Sign Out"
        // (like Instagram/Facebook). The session cookie may have
        // expired but the local data is still valid for offline use.
        console.log('[AppSessionProvider] no session and no cache, staying on login');
        setUserAndCache(null);
      } else {
        console.log('[AppSessionProvider] backend says no session but cached user exists, keeping cache');
      }
      setLoading(false);
    })();

      }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Deep-link callback from OAuth on native ──────────────────────────
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    urlOpenHandle.current?.remove();

    App.addListener('appUrlOpen', async ({ url }) => {
      if (url.startsWith('timeharbor://identity/callback')) {
        await Browser.close().catch(() => {});
        const u = await refreshSession();
        if (u) {
          setLoading(false);
          router.replace('/dashboard');
        }
      } else if (url.startsWith('timeharbor://share')) {
        // Deep link from QR scan: timeharbor://share?uuid=X&key=Y
        try {
          const parsed = new URL(url);
          const uuid = parsed.searchParams.get('uuid');
          const key = parsed.searchParams.get('key');
          if (uuid && key) {
            // Navigate to share page with params (Next.js handles the query)
            router.push(`/share?uuid=${uuid}&key=${encodeURIComponent(key)}`);
          } else if (uuid) {
            router.push(`/share?uuid=${uuid}`);
          }
        } catch { /* invalid URL */ }
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
      console.log('[AppSessionProvider] app resumed, refreshing session');
      await refreshSession();
    }).then((h) => { stateChangeHandle.current = h; });

    return () => { stateChangeHandle.current?.remove(); stateChangeHandle.current = null; };
  }, [refreshSession]);

  // ── Re-validate session when network reconnects (offline → online) ───
  useEffect(() => {
    const handleOnline = () => {
      console.log('[AppSessionProvider] network reconnected, refreshing session');
      refreshSession();
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [refreshSession]);

  // ── Redirect: only after loading is done ─────────────────────────────
  useEffect(() => {
    if (loading) return;

    const p = pathname === '/' ? '/' : pathname?.replace(/\/$/, '') || '';
    const isRoot = p === '/';

    console.log('[AppSessionProvider] routing', { user: !!user, path: p });

    // Root → always go to dashboard (no identity gate)
    if (isRoot) {
      router.replace('/dashboard');
    }
    // Unauthenticated users can access /dashboard freely — no identity gate
  }, [user, loading, pathname, router]);


  // ── Listen for local identity changes ────────────────────────────────
  useEffect(() => {
    const sub = identity.onAuthStateChange((event, session) => {
      if (event === 'USER_UPDATED') {
        console.log('[AppSessionProvider] Identity updated from event:', session.user); alert('Identity updated!!');
        setUserAndCache(session.user);
      }
    });
    return () => sub.unsubscribe();
  }, [setUserAndCache]);

  return (
    <AppSessionContext.Provider value={{ user, loading, initialSyncing }}>
      {children}
    </AppSessionContext.Provider>
  );
}
