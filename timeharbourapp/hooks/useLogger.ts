'use client';

import { useActivityLog } from "@/components/dashboard/ActivityLogContext";
import { Activity } from "@/TimeharborAPI/dashboard";

/**
 * A hook that provides a logger interface for the Recent Activity feed.
 * Allows pushing logs that are displayed to the user, with support for active/completed states.
 */
export function useLogger() {
  const { addActivity, updateActivity } = useActivityLog();

  return {
    /**
     * Log a standard completed action.
     * @param message The main title of the log
     * @param details Additional details (subtitle, description, etc)
     */
    log: (message: string, details?: Partial<Omit<Activity, 'id' | 'title'>> & { teamId?: string }) => {
      // If teamId is provided at call-site, queue directly to Dexie
      if (details?.teamId) {
        try {
          const newActivity: Activity = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            type: 'LOG', 
            startTime: new Date().toISOString(),
            status: 'Completed',
            title: message,
            ...details
          } as Activity;

          // Remove utility prop
          const teamId = details.teamId;
          delete (newActivity as any).teamId;

          // Write to Dexie activityLogs (cache) - so it appears when we switch to that team
          // But wait, the context uses 'where teamId equals currentTeam'. So if we switch, it loads.
          // BUT, we need to ensure the record HAS a teamId property for Dexie to index/filter it!
          // The Activity interface usually has teamId? Let's check.
          // If not, we must add it to the record stored in Dexie.
          
          (newActivity as any).teamId = teamId;
          
          // Import db dynamically or use global if available (hooks are client side)
          import('@/TimeharborAPI/db').then(({ db }) => {
             db.activityLogs.put(newActivity);
             
             // Queue Sync
             db.offlineMutations.add({
                url: `/api/teams/${teamId}/logs/sync`,
                method: 'POST',
                body: [newActivity],
                timestamp: Date.now(),
                retryCount: 0
             });
          });

          return;
        } catch (e) {
          console.error('Failed to log to specific team storage', e);
        }
      }

      // Normal flow
      addActivity({
        type: 'LOG',
        title: message,
        startTime: new Date().toISOString(),
        status: 'Completed',
        ...details
      });
    },

    /**
     * Start an "Active" action (shows green in UI).
     * @returns The ID of the created activity, which can be used to complete it later.
     */
    start: (action: string, details?: Partial<Omit<Activity, 'id' | 'title'>>) => {
      const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
      addActivity({
        id, // We manually assign ID so we can return it
        type: 'SESSION',
        title: action,
        startTime: new Date().toISOString(),
        status: 'Active',
        ...details
      });
      return id;
    },

    /**
     * Mark an active action as completed.
     * @param id The ID returned by start()
     * @param details Final details (e.g. duration, end time)
     */
    complete: (id: string, details?: Partial<Omit<Activity, 'id'>>) => {
      updateActivity(id, {
        status: 'Completed',
        endTime: new Date().toISOString(),
        ...details
      });
    },

    /**
     * Log an error or failed action.
     */
    error: (message: string, error?: any) => {
      addActivity({
        type: 'ERROR',
        title: message,
        subtitle: error?.message || String(error),
        startTime: new Date().toISOString(),
        status: 'Failed',
        description: error?.stack ? 'Check console for details' : undefined
      });
      console.error(message, error);
    }
  };
}
