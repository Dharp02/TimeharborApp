'use client';

import { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type DexieWorkSession } from '../db';
import { computeSession, type SessionStats } from '@timeharbor/time-engine';

/**
 * useSession — reactive hook for the current open work session.
 *
 * Reads the open session from Dexie via useLiveQuery (auto-updates on mutation).
 * Ticks referenceTime every second to keep computed stats live for open sessions.
 *
 * Uses a ref for the session inside the interval callback to avoid
 * re-creating the interval every time the session document mutates.
 */
export function useSession(userId: string | undefined) {
  const [stats, setStats] = useState<SessionStats | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const sessionRef = useRef<DexieWorkSession | undefined>(undefined);

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

  // Keep ref in sync so the interval always reads the latest session
  sessionRef.current = currentSession;

  // Recompute immediately when session changes
  useEffect(() => {
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

  // Single stable interval — reads session from ref, never re-created
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      const session = sessionRef.current;
      if (!session || session.clockOut !== null) return;
      const computed = computeSession(
        {
          clockIn: session.clockIn,
          clockOut: session.clockOut,
          ticketSegments: session.ticketSegments,
          breaks: session.breaks,
        },
        Date.now()
      );
      setStats(computed);
    }, 1000);

    return () => clearInterval(intervalRef.current);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    currentSession: currentSession ?? null,
    stats,
    isOpen: stats?.isOpen ?? false,
    isOnBreak: stats?.isOnBreak ?? false,
    activeTicketId: stats?.activeTicketId ?? null,
  };
}
