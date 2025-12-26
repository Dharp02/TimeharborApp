'use client';

import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { auth } from '@/TimeharborAPI';

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
        try {
          const { user, error } = await auth.getUser();
          if (error) {
            throw error;
          }
          setUser(user);
        } catch (error) {
          console.error('Error checking session:', error);
          setUser(null);
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

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  useEffect(() => {
    if (loading) return;

    const isAuthPage = pathname === '/login' || pathname === '/signup' || pathname === '/forgot-password' || pathname === '/';
    const isDashboardPage = pathname?.startsWith('/dashboard');

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
