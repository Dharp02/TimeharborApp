'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { auth } from '@/TimeharborAPI';
import { clearAuthStorage } from '@/TimeharborAPI/core/storage';

type AuthContextType = {
  user: any | null;
  loading: boolean;
  clearSession: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  loading: true,
  clearSession: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // Manual session clear function for force logout scenarios
  const clearSession = async () => {
    console.log('Manually clearing session...');
    setUser(null);
    await clearAuthStorage();
    router.push('/login');
  };

  useEffect(() => {
    const checkSession = async () => {
      try {
        const { session, error } = await auth.getSession();
        if (error) {
          throw error;
        }
        setUser(session?.user ?? null);
      } catch (error) {
        console.error('Error checking session:', error);
        await auth.signOut();
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkSession();

    const subscription = auth.onAuthStateChange((event, session) => {
      console.log('Auth state change:', event, session);
      setUser(session?.user ?? null);
      setLoading(false);
      
      if (event === 'SIGNED_IN') {
        router.push('/dashboard');
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        router.push('/login');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  useEffect(() => {
    if (!loading) {
        if (user && (pathname === '/login' || pathname === '/signup' || pathname === '/forgot-password' || pathname === '/')) {
            router.push('/dashboard');
        } else if (!user && pathname.startsWith('/dashboard')) {
            router.push('/login');
        }
    }
  }, [user, loading, pathname, router]);

  return (
    <AuthContext.Provider value={{ user, loading, clearSession }}>
      {children}
    </AuthContext.Provider>
  );
}
