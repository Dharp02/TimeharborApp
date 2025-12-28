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
          // Try to get stored user first for immediate UI feedback
          // The getUser function in API is now optimized to return stored user on network failure
          // but we can also check local storage directly here if needed.
          // For now, we rely on the optimized getUser()
          
          const { user, error } = await auth.getUser();
          if (error) {
            throw error;
          }
          setUser(user);
        } catch (error: any) {
          // Only log real errors, not session expiration
          if (error?.message !== 'Session expired') {
            console.error('Error checking session:', error);
          }
          // Don't overwrite an existing user (e.g. from immediate signup) with null
          // If checkSession fails, we just leave the user as is (null or set by signup)
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
