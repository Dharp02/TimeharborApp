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
      // If teamId is provided at call-site, bypass React context and persist directly to storage
      if (details?.teamId) {
        try {
          const logsKey = `timeharbor_activity_log_${details.teamId}`;
          const currentLogs = localStorage.getItem(logsKey);
          let currentActivities: Activity[] = [];
          if (currentLogs) {
             try { currentActivities = JSON.parse(currentLogs); } catch (e) {
               console.warn("Failed to parse logs for team", details.teamId);
             }
          }

          const newActivity: Activity = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            type: 'LOG', 
            startTime: new Date().toISOString(),
            status: 'Completed',
            title: message,
            ...details
          } as Activity;

          // Remove the utility prop so it doesn't get saved
          delete (newActivity as any).teamId;

          const updatedActivities = [newActivity, ...currentActivities];
          localStorage.setItem(logsKey, JSON.stringify(updatedActivities));
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
