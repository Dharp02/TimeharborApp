'use client';

import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { auth } from '@/TimeharborAPI';
import { db } from '@/TimeharborAPI/db';

type AuthContextType = {
  user: any | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType>({ user: null, loading: true });

export const useAuth = () => useContext(AuthContext);

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const isMounted = useRef(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isMounted.current) {
      const checkSession = async () => {
        // Item 11: Skip network call when offline — avoids "Failed to fetch" crashes
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          try {
            const cached = await db.profile.get('user');
            if (cached?.data) setUser(cached.data);
          } catch (_) {}
          setLoading(false);
          return;
        }

        // Item 10: Seed from Dexie before network resolves — UI unblocks in ~1ms
        try {
          const cached = await db.profile.get('user');
          if (cached?.data) {
            setUser(cached.data);
            setLoading(false);
          }
        } catch (_) {}

        try {
          const { user, error } = await auth.getUser();
          if (error) throw error;
          setUser(user);
        } catch (error: any) {
          if (error?.message !== 'Session expired') {
            console.error('Error checking session:', error);
          }
        } finally {
          setLoading(false);
        }
      };
      checkSession();
      isMounted.current = true;
    }

    const subscription = auth.onAuthStateChange((event, session) => {
      console.log('Auth state change:', event, session);
      
      if (event === 'SIGNED_IN') {
        setUser(session?.user ?? null);
        router.refresh();
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        router.refresh();
      }
    });

    // Item 12: Auto-recover session when network returns after being offline
    const handleOnline = () => {
      auth.getUser().then(({ user, error }) => {
        if (!error && user) setUser(user);
      });
    };
    window.addEventListener('online', handleOnline);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('online', handleOnline);
    };
  }, [router]);

  useEffect(() => {
    if (loading) return;

    // Normalize pathname by removing trailing slash if present (except for root)
    const normalizedPath = pathname === '/' ? '/' : pathname?.replace(/\/$/, '') || '';
    
    const isAuthPage = ['/login', '/signup', '/forgot-password', '/'].includes(normalizedPath);
    const isDashboardPage = normalizedPath.startsWith('/dashboard');

    if (user && isAuthPage) {
      router.replace('/dashboard');
    } else if (!user && isDashboardPage) {
      router.replace('/login');
    }
  }, [user, loading, pathname, router]);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
