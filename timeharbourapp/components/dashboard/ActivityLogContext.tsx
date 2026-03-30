'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Activity } from '@/TimeharborAPI/dashboard';
import { db, type DexieActivityLog } from '@/TimeharborAPI/db';
import { useRefresh } from '../../contexts/RefreshContext';
import { useAuth } from '@/components/auth/AuthProvider';

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
  const { register, lastRefreshed } = useRefresh();
  const { user } = useAuth();
  const [activities, setActivities] = useState<Activity[]>([]);
  const isLoadedRef = React.useRef(false);

  const effectiveTeamId = '__personal__';

  // Load from Dexie on mount and after sync completes
  const loadLogs = useCallback(async () => {
    isLoadedRef.current = false;
    try {
      const localLogs = await db.activityLogs
        .where('teamId')
        .equals(effectiveTeamId)
        .toArray();
        
      localLogs.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
        
      setActivities(localLogs);
    } catch (e) {
      console.error('Failed to load activity logs from Dexie', e);
    } finally {
      isLoadedRef.current = true;
    }
  }, [effectiveTeamId]);

  useEffect(() => {
    loadLogs();

    const unregister = register(loadLogs);

    const onSyncComplete = () => loadLogs();
    window.addEventListener('sync-complete', onSyncComplete);
    return () => {
      unregister();
      window.removeEventListener('sync-complete', onSyncComplete);
    };
  }, [effectiveTeamId, loadLogs, register]);



  const addActivity = (activity: Partial<Activity> & { title: string }) => {
    const id = activity.id || Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const newActivity: Activity = {
      id,
      teamId: effectiveTeamId,
      userId: user?.id || activity.userId || undefined,
      type: 'LOG', 
      startTime: activity.startTime || new Date().toISOString(),
      status: 'Completed',
      ...activity
    } as Activity;
    
    // Optimistic Update UI
    setActivities(prev => [newActivity, ...prev]);

    // Persist to Dexie with sync fields
    const record: DexieActivityLog = {
      ...newActivity,
      _dirty: 1,
      _rev: 1,
    };
    db.activityLogs.put(record).catch(e => console.error('Dexie put failed', e));
    
    return id;
  };

  const updateActivity = (id: string, updates: Partial<Activity>) => {
    setActivities(prev => prev.map(activity => 
      activity.id === id ? { ...activity, ...updates } : activity
    ));
    
    // Update Dexie with dirty flag
    db.activityLogs.update(id, { ...updates, _dirty: 1 });
  };

  const updateActiveSession = (endTime: string, duration: string) => {
    setActivities(prev => prev.map(activity => {
      if (activity.status === 'Active' && activity.type === 'SESSION') {
        const updated = {
          ...activity,
          status: 'Completed',
          endTime,
          duration
        } as Activity;
        
        // Update Dexie with dirty flag
        db.activityLogs.put({ ...updated, _dirty: 1, _rev: ((updated as any)._rev || 0) + 1 } as DexieActivityLog);
         
        return updated;
      }
      return activity;
    }));
  };

  const clearActivities = () => setActivities([]);

  const fetchActivitiesByDateRange = async (startDate: string, endDate: string): Promise<Activity[]> => {
    try {
      const localLogs = await db.activityLogs
        .where('teamId')
        .equals('__personal__')
        .toArray();
      return localLogs.filter(a => a.startTime >= startDate && a.startTime <= endDate);
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
