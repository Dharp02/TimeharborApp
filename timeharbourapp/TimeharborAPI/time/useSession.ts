'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type DexieWorkSession } from '../db';
import { computeSession, type SessionStats } from '@timeharbor/time-engine';

/**
 * useSession — reactive hook for the current open work session.
 *
 * Reads the open session from Dexie via useLiveQuery (auto-updates on mutation).
 * Ticks referenceTime every second to keep computed stats live for open sessions.
 */
export function useSession(userId: string | undefined) {
  const [stats, setStats] = useState<SessionStats | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  // Reactively query the open session for this user
  const currentSession = useLiveQuery(
    () => {
      if (!userId) return undefined;
      return db.workSessions
        .where('userId')
        .equals(userId)
        .filter(s => s.clockOut === null)
        .first();
    },
    [userId],
    undefined
  );

  // Recompute stats whenever session changes or every second (for live timers)
  const recompute = useCallback(() => {
    if (!currentSession) {
      setStats(null);
      return;
    }

    const computed = computeSession(
      {
        clockIn: currentSession.clockIn,
        clockOut: currentSession.clockOut,
        ticketSegments: currentSession.ticketSegments,
        breaks: currentSession.breaks,
      },
      Date.now()
    );

    setStats(computed);
  }, [currentSession]);

  // Recompute immediately when session changes
  useEffect(() => {
    recompute();
  }, [recompute]);

  // Tick every 1s for open sessions
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = undefined;
    }

    if (currentSession && currentSession.clockOut === null) {
      intervalRef.current = setInterval(recompute, 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [currentSession, recompute]);

  return {
    currentSession: currentSession ?? null,
    stats,
    isOpen: stats?.isOpen ?? false,
    isOnBreak: stats?.isOnBreak ?? false,
    activeTicketId: stats?.activeTicketId ?? null,
  };
}
