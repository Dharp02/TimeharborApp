'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Activity } from '@/TimeharborAPI/dashboard';
import { useTeam } from './TeamContext';
import { db } from '@/TimeharborAPI/db';
import { Network, ConnectionStatus } from '@capacitor/network';
import { authenticatedFetch } from '@/TimeharborAPI/auth';
import { syncManager } from '@/TimeharborAPI/SyncManager';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface ActivityLogContextType {
  activities: Activity[];
  addActivity: (activity: Partial<Activity> & { title: string }) => string;
  updateActivity: (id: string, updates: Partial<Activity>) => void;
  updateActiveSession: (endTime: string, duration: string) => void;
  clearActivities: () => void;
}

const ActivityLogContext = createContext<ActivityLogContextType | undefined>(undefined);

export function ActivityLogProvider({ children }: { children: React.ReactNode }) {
  const { currentTeam } = useTeam();
  const [activities, setActivities] = useState<Activity[]>([]);
  const isLoadedRef = React.useRef(false);

  // Sync with backend when online
  useEffect(() => {
    if (!currentTeam?.id) return;

    const syncWithBackend = async () => {
      const status = await Network.getStatus();
      if (!status.connected) return;

      try {
        // Ensure strictly that we push any pending local changes first
        // This minimizes the chance of "pending > 0" incorrectly preventing a full refresh
        if (syncManager && typeof syncManager.syncNow === 'function') {
           await syncManager.syncNow(); 
        }

        const response = await authenticatedFetch(`${API_URL}/teams/${currentTeam.id}/logs`);
        if (response.ok) {
          const remoteLogs = await response.json();
          if (Array.isArray(remoteLogs)) {
            // Re-check pending count after sync attempt
            // We use a more permissive check to catch any mutations for this endpoint
            const pendingMutations = await db.offlineMutations
              .filter(m => m.url.indexOf(`/teams/${currentTeam.id}/logs`) >= 0)
              .toArray();
            
            const pendingCount = pendingMutations.length;

            await db.transaction('rw', db.activityLogs, async () => {
                // 1. Clear local logs for this team (Server is source of truth)
                await db.activityLogs.where('teamId').equals(currentTeam.id).delete();
                
                // 2. Add fresh logs from server
                if (remoteLogs.length > 0) {
                  await db.activityLogs.bulkPut(remoteLogs);
                }

                // 3. Re-apply pending local changes that haven't synced yet
                if (pendingCount > 0) {
                   const itemsToRestore: Activity[] = [];
                   pendingMutations.forEach(m => {
                      if (Array.isArray(m.body)) {
                         m.body.forEach((item: any) => {
                            itemsToRestore.push({ ...item, teamId: currentTeam.id });
                         });
                      }
                   });
                   
                   if (itemsToRestore.length > 0) {
                      await db.activityLogs.bulkPut(itemsToRestore);
                   }
                }
            });
            
            // Reload from Dexie to get merged view (sorted correctly)
            const allLogs = await db.activityLogs
              .where('teamId')
              .equals(currentTeam.id)
              .toArray();
            
            // Sort by startTime descending
            allLogs.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
            
            setActivities(allLogs);
          }
        }
      } catch (error) {
        console.error('Failed to sync activity logs:', error);
      }
    };

    // Initial sync
    syncWithBackend();

    // Listen for pull-to-refresh event
    const handleRefresh = () => {
        console.log('Refreshing activity logs due to pull-to-refresh');
        syncWithBackend();
    };
    window.addEventListener('pull-to-refresh', handleRefresh);

    // Listen for network status changes
    // AddListener returns a promise, so we need to handle it properly
    const handlerPromise = Network.addListener('networkStatusChange', status => {
      if (status.connected) {
        syncWithBackend();
      }
    });

    return () => {
      window.removeEventListener('pull-to-refresh', handleRefresh);
      handlerPromise.then(handler => handler.remove());
    };
  }, [currentTeam?.id]);

  // Load from Dexie when team changes
  useEffect(() => {
    if (!currentTeam?.id) {
      setActivities([]);
      return;
    }

    const loadLogs = async () => {
      isLoadedRef.current = false;
      try {
        // Read local logs from Dexie
        const localLogs = await db.activityLogs
          .where('teamId')
          .equals(currentTeam.id)
          .toArray();
          
        // Sort by startTime descending
        localLogs.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
          
        setActivities(localLogs);
      } catch (e) {
        console.error('Failed to load activity logs from Dexie', e);
      } finally {
        isLoadedRef.current = true;
      }
    };

    loadLogs();
  }, [currentTeam?.id]);



  const addActivity = (activity: Partial<Activity> & { title: string }) => {
    if (!currentTeam?.id) return ''; // Should guard against no team

    const id = activity.id || Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const newActivity: Activity = {
      id,
      teamId: currentTeam.id, // Ensure teamId is attached
      userId: activity.userId || undefined, // Allow frontend to pass userId if available
      type: 'LOG', 
      startTime: activity.startTime || new Date().toISOString(),
      status: 'Completed',
      ...activity
    } as Activity;
    
    // Optimistic Update UI
    setActivities(prev => [newActivity, ...prev]);

    // Persist to Dexie
    db.activityLogs.put(newActivity).catch(e => console.error('Dexie put failed', e));

    // Queue for Sync using SyncManager
    if (typeof syncManager.addMutation === 'function') {
      syncManager.addMutation(
        `/teams/${currentTeam.id}/logs/sync`,
        'POST',
        [newActivity],
        newActivity.id
      ).catch(e => console.error('SyncManager add failed', e));
    } else {
      // Fallback if SyncManager not ready
      db.offlineMutations.add({
        url: `/teams/${currentTeam.id}/logs/sync`,
        method: 'POST',
        body: [newActivity],
        timestamp: Date.now(),
        retryCount: 0,
        tempId: newActivity.id
      }).catch(e => console.error('Mutation add failed', e));
    }
    
    return id;
  };

  const updateActivity = (id: string, updates: Partial<Activity>) => {
    setActivities(prev => prev.map(activity => 
      activity.id === id ? { ...activity, ...updates } : activity
    ));
    
    // Update Dexie
    db.activityLogs.update(id, updates);
    
    // Queue Sync
    if (currentTeam?.id) {
       const endpoint = `/teams/${currentTeam.id}/logs/sync`;
       const body = [{ id, ...updates }];
       
       if (typeof syncManager.addMutation === 'function') {
         syncManager.addMutation(endpoint, 'POST', body)
           .catch(e => console.error('SyncManager update failed', e));
       } else {
         db.offlineMutations.add({
            url: endpoint,
            method: 'POST',
            body,
            timestamp: Date.now(),
            retryCount: 0
         });
       }
    }
  };

  const updateActiveSession = (endTime: string, duration: string) => {
    // Similar to updateActivity but specific logic
    setActivities(prev => prev.map(activity => {
      if (activity.status === 'Active' && activity.type === 'SESSION') {
        const updated = {
          ...activity,
          status: 'Completed',
          endTime,
          duration
        } as Activity;
        
        // Update Dexie
        db.activityLogs.put(updated);
        
        // Queue Sync
         if (currentTeam?.id) {
            const endpoint = `/teams/${currentTeam.id}/logs/sync`;
            const body = [updated];
            
            if (typeof syncManager.addMutation === 'function') {
               syncManager.addMutation(endpoint, 'POST', body)
                  .catch(e => console.error('SyncManager update session failed', e));
            } else {
                db.offlineMutations.add({
                    url: endpoint,
                    method: 'POST',
                    body,
                    timestamp: Date.now(),
                    retryCount: 0
                });
            }
         }
         
        return updated;
      }
      return activity;
    }));
  };

  const clearActivities = () => setActivities([]);

  return (
    <ActivityLogContext.Provider value={{ activities, addActivity, updateActivity, updateActiveSession, clearActivities }}>
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
