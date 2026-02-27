'use client';

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

type RefreshCallback = () => Promise<void>;

interface RefreshContextType {
  register: (callback: RefreshCallback) => () => void;
  refreshAll: () => Promise<void>;
  lastRefreshed: number;
}

const RefreshContext = createContext<RefreshContextType | undefined>(undefined);

export function RefreshProvider({ children }: { children: React.ReactNode }) {
  const [lastRefreshed, setLastRefreshed] = useState(Date.now());
  const callbacksRef = useRef<Set<RefreshCallback>>(new Set());

  const register = useCallback((callback: RefreshCallback) => {
    callbacksRef.current.add(callback);
    return () => {
      callbacksRef.current.delete(callback);
    };
  }, []);

  const refreshAll = useCallback(async () => {
    const promises = Array.from(callbacksRef.current).map(async (callback) => {
      try {
        await callback();
      } catch (error) {
        console.error('Error in refresh callback:', error);
      }
    });

    await Promise.all(promises);
    setLastRefreshed(Date.now());
  }, []);

  const value = React.useMemo(() => ({
    register,
    refreshAll,
    lastRefreshed
  }), [register, refreshAll, lastRefreshed]);

  return (
    <RefreshContext.Provider value={value}>
      {children}
    </RefreshContext.Provider>
  );
}

export function useRefresh() {
  const context = useContext(RefreshContext);
  if (context === undefined) {
    throw new Error('useRefresh must be used within a RefreshProvider');
  }
  return context;
}
