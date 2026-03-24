'use client';

import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { auth } from '@/TimeharborAPI';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';

type AuthContextType = {
  user: any | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType>({ user: null, loading: true });

export const useAuth = () => useContext(AuthContext);

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const networkErrorRef = useRef(false);
  const isMounted = useRef(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isMounted.current) {
      const checkSession = async () => {
        const { user, error } = await auth.getUser();
        if (error) {
          // Network error — keep existing session state, don't log out
          networkErrorRef.current = true;
          setLoading(false);
          return;
        }
        networkErrorRef.current = false;
        if (user) setUser(user);
        setLoading(false);
      };
      checkSession();
      isMounted.current = true;
    }

    const subscription = auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') {
        setUser(session?.user ?? null);
        router.refresh();
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        router.refresh();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  // Handle deep link callback from OAuth on native (Capacitor)
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const handler = App.addListener('appUrlOpen', async ({ url }) => {
      if (url.startsWith('timeharbor://auth/callback')) {
        // Close the system browser that was opened for OAuth
        await Browser.close();
        // Refresh session — Better Auth set the cookie via the redirect
        const { user: authUser } = await auth.getUser();
        if (authUser) {
          setUser(authUser);
          router.replace('/dashboard');
        }
      }
    });

    return () => {
      handler.then((h) => h.remove());
    };
  }, [router]);

  useEffect(() => {
    if (loading) return;

    const normalizedPath = pathname === '/' ? '/' : pathname?.replace(/\/$/, '') || '';
    
    const isAuthPage = ['/login', '/signup', '/forgot-password', '/'].includes(normalizedPath);
    const isDashboardPage = normalizedPath.startsWith('/dashboard');

    if (user && isAuthPage) {
      router.replace('/dashboard');
    } else if (!user && isDashboardPage && !networkErrorRef.current) {
      router.replace('/login');
    }
  }, [user, loading, pathname, router]);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
