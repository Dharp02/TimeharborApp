'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Activity } from '@/TimeharborAPI/dashboard';
import { useTeam } from './TeamContext';
import { db } from '@/TimeharborAPI/db';
import { Network } from '@capacitor/network';
import { authenticatedFetch } from '@/TimeharborAPI/auth';
import { useRefresh } from '../../contexts/RefreshContext';
import { useSocket } from '@/contexts/SocketContext';
import { getApiUrl } from '@/TimeharborAPI/apiUrl';

const API_URL = getApiUrl();

interface ActivityLogContextType {
  activities: Activity[];
  addActivity: (activity: Partial<Activity> & { title: string }) => string;
  updateActivity: (id: string, updates: Partial<Activity>) => void;
  updateActiveSession: (endTime: string, duration: string) => void;
  clearActivities: () => void;
  fetchActivitiesByDateRange: (startDate: string, endDate: string) => Promise<Activity[]>;
}

const ActivityLogContext = createContext<ActivityLogContextType | undefined>(undefined);

export function ActivityLogProvider({ children }: { children: React.ReactNode }) {
  const { currentTeam } = useTeam();
  const { register, lastRefreshed } = useRefresh();
  const { socket } = useSocket();
  const [activities, setActivities] = useState<Activity[]>([]);
  // Tracks in-flight writes so socket-triggered syncs don't race with them
  const pendingWriteRef = useRef(false);

  /**
   * Pull the latest logs from the server, write them into Dexie (source of truth),
   * and update React state. Called on: mount, team change, pull-to-refresh,
   * network reconnect, and socket events from other devices.
   */
  const syncWithBackend = useCallback(async () => {
    if (!currentTeam?.id) return;
    const status = await Network.getStatus();
    if (!status.connected) return;

    try {
      const response = await authenticatedFetch(`${API_URL}/teams/${currentTeam.id}/logs`);
      if (!response.ok) return;
      const remoteLogs = await response.json();
      if (!Array.isArray(remoteLogs)) return;

      // Replace Dexie cache with authoritative server data for this team
      await db.transaction('rw', db.activityLogs, async () => {
        await db.activityLogs.where('teamId').equals(currentTeam.id).delete();
        if (remoteLogs.length > 0) {
          await db.activityLogs.bulkPut(remoteLogs);
        }
      });

      // Read back sorted
      const allLogs = await db.activityLogs.where('teamId').equals(currentTeam.id).toArray();
      allLogs.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
      setActivities(allLogs);
    } catch (error) {
      console.error('ActivityLog sync failed:', error);
    }
  }, [currentTeam?.id]);

  /**
   * Write one or more activity entries directly to the backend immediately (online path).
   * Falls back to queuing in Dexie offlineMutations when offline.
   * After a successful write, re-syncs Dexie so UI reflects server state.
   */
  const pushToBackend = useCallback(async (teamId: string, items: Activity[]) => {
    const status = await Network.getStatus();
    if (!status.connected) {
      // Offline: queue for later
      await db.offlineMutations.add({
        url: `/teams/${teamId}/logs/sync`,
        method: 'POST',
        body: items,
        timestamp: Date.now(),
        retryCount: 0,
        tempId: items[0]?.id,
      }).catch(() => {});
      return;
    }

    pendingWriteRef.current = true;
    try {
      await authenticatedFetch(`${API_URL}/teams/${teamId}/logs/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(items),
      });
      // Refresh Dexie from server so this device has the canonical data
      await syncWithBackend();
    } catch (e) {
      console.error('ActivityLog push failed:', e);
    } finally {
      pendingWriteRef.current = false;
    }
  }, [syncWithBackend]);

  // ── Boot: load Dexie cache immediately, then fetch fresh from server ──────
  useEffect(() => {
    if (!currentTeam?.id) {
      setActivities([]);
      return;
    }

    // Show cached data instantly while the network call is in flight
    db.activityLogs
      .where('teamId').equals(currentTeam.id)
      .toArray()
      .then(local => {
        local.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
        setActivities(local);
      })
      .catch(() => {});

    // Then sync with server for fresh data
    syncWithBackend();
  }, [currentTeam?.id, syncWithBackend]);

  // ── Pull-to-refresh & network reconnect ───────────────────────────────────
  useEffect(() => {
    if (!currentTeam?.id) return;

    const unregister = register(() => syncWithBackend());
    const handleRefresh = () => syncWithBackend();
    window.addEventListener('pull-to-refresh', handleRefresh);

    const handlerPromise = Network.addListener('networkStatusChange', s => {
      if (s.connected) syncWithBackend();
    });

    return () => {
      unregister();
      window.removeEventListener('pull-to-refresh', handleRefresh);
      handlerPromise.then(h => h.remove());
    };
  }, [currentTeam?.id, register, lastRefreshed, syncWithBackend]);

  // ── WebSocket: real-time sync from other devices ──────────────────────────
  // `session_state_restore` is emitted by the backend to all sockets in the
  // user's room after every sync commit (clock-in, clock-out, break, ticket).
  // When another device triggers one of these events we:
  //  1. Optimistically hide the stale "Active" badge immediately
  //  2. Re-sync from the server to get the real updated entries
  useEffect(() => {
    if (!socket) return;

    const handleSessionStateRestore = (state: { isSessionActive: boolean }) => {
      // Don't race with our own in-flight write
      if (pendingWriteRef.current) return;

      if (!state.isSessionActive) {
        // Immediately clear Active badge — server data will confirm shortly
        setActivities(prev =>
          prev.map(a =>
            a.status === 'Active' && a.type === 'SESSION'
              ? { ...a, status: 'Completed' as Activity['status'] }
              : a
          )
        );
      }
      syncWithBackend();
    };

    // `stats_updated` fires after any work_log write — catch ticket/break events too
    const handleStatsUpdated = () => {
      if (!pendingWriteRef.current) syncWithBackend();
    };

    // `activity_logs_updated` fires from the backend AFTER activity_logs are
    // committed to the DB via POST /teams/:id/logs/sync. Using this event
    // (instead of relying solely on stats_updated) ensures Device B syncs
    // only once the new data is actually persisted — preventing stale reads.
    const handleActivityLogsUpdated = () => {
      if (!pendingWriteRef.current) syncWithBackend();
    };

    socket.on('session_state_restore', handleSessionStateRestore);
    socket.on('stats_updated', handleStatsUpdated);
    socket.on('activity_logs_updated', handleActivityLogsUpdated);
    return () => {
      socket.off('session_state_restore', handleSessionStateRestore);
      socket.off('stats_updated', handleStatsUpdated);
      socket.off('activity_logs_updated', handleActivityLogsUpdated);
    };
  }, [socket, syncWithBackend]);

  // ── Mutations ─────────────────────────────────────────────────────────────

  const addActivity = (activity: Partial<Activity> & { title: string }): string => {
    if (!currentTeam?.id) return '';

    const id = activity.id || `${Date.now()}${Math.random().toString(36).slice(2, 9)}`;
    const newActivity: Activity = {
      id,
      teamId: currentTeam.id,
      type: 'LOG',
      startTime: new Date().toISOString(),
      status: 'Completed',
      ...activity,
    } as Activity;

    // 1. Optimistic UI update
    setActivities(prev => [newActivity, ...prev]);

    // 2. Write to Dexie immediately
    db.activityLogs.put(newActivity).catch(() => {});

    // 3. Push to backend (online: immediate POST; offline: queue)
    pushToBackend(currentTeam.id, [newActivity]);

    return id;
  };

  const updateActivity = (id: string, updates: Partial<Activity>) => {
    // 1. Optimistic UI update
    setActivities(prev => prev.map(a => (a.id === id ? { ...a, ...updates } : a)));

    // 2. Update Dexie
    db.activityLogs.update(id, updates).catch(() => {});

    // 3. Push to backend
    if (currentTeam?.id) {
      pushToBackend(currentTeam.id, [{ id, ...updates } as Activity]);
    }
  };

  const updateActiveSession = (endTime: string, duration: string) => {
    let updated: Activity | null = null;

    setActivities(prev =>
      prev.map(a => {
        if (a.status === 'Active' && a.type === 'SESSION') {
          updated = { ...a, status: 'Completed' as Activity['status'], endTime, duration };
          return updated;
        }
        return a;
      })
    );

    if (updated && currentTeam?.id) {
      // 2. Write to Dexie
      db.activityLogs.put(updated).catch(() => {});
      // 3. Push to backend
      pushToBackend(currentTeam.id, [updated]);
    }
  };

  const clearActivities = () => setActivities([]);

  const fetchActivitiesByDateRange = async (startDate: string, endDate: string): Promise<Activity[]> => {
    if (!currentTeam?.id) return [];
    try {
      const response = await authenticatedFetch(
        `${API_URL}/teams/${currentTeam.id}/logs?startDate=${startDate}&endDate=${endDate}`
      );
      if (response.ok) {
        const data = await response.json();
        return Array.isArray(data) ? data : [];
      }
      return [];
    } catch {
      return [];
    }
  };

  return (
    <ActivityLogContext.Provider value={{ activities, addActivity, updateActivity, updateActiveSession, clearActivities, fetchActivitiesByDateRange }}>
      {children}
    </ActivityLogContext.Provider>
  );
}

export function useActivityLog() {
  const context = useContext(ActivityLogContext);
  if (context === undefined) {
    throw new Error('useActivityLog must be used within an ActivityLogProvider');
  }
  return context;
}
