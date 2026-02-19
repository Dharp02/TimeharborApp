'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Activity } from '@/TimeharborAPI/dashboard';
import { useTeam } from './TeamContext';

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
  
  // Key derived from current team
  const logsKey = `timeharbor_activity_log_${currentTeam?.id || 'global'}`;
  const isLoadedRef = React.useRef(false);

  // Load from local storage when logsKey changes
  useEffect(() => {
    // Reset loaded state at start of effect (or could be cleanup of previous)
    // Actually, setting it false here protects against synchronous execution issues
    isLoadedRef.current = false;
    
    const saved = localStorage.getItem(logsKey);
    let loadedActivities: Activity[] = [];
    if (saved) {
      try {
        loadedActivities = JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse activity log', e);
        loadedActivities = [];
      }
    }
    
    // Set state - this triggers passing new activities to re-render
    setActivities(loadedActivities);
    
    // Mark as loaded immediately for subsequent updates
    // Note: The state update above handles the "load" part
    // But we need to signal that subsequent saves are valid
    // We can use a setTimeout to ensure we skip the immediate effect from setActivities?
    // Or check if current activities match loaded?
    
    requestAnimationFrame(() => {
      isLoadedRef.current = true;
    });
  }, [logsKey]);

  // Save to local storage on change
  useEffect(() => {
    if (isLoadedRef.current) {
      try {
        localStorage.setItem(logsKey, JSON.stringify(activities));
      } catch (e) {
        console.warn('Failed to save activity log', e);
      }
    }
  }, [activities, logsKey]);

  const addActivity = (activity: Partial<Activity> & { title: string }) => {
    const id = activity.id || Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const newActivity: Activity = {
      id,
      type: 'LOG', 
      startTime: activity.startTime || new Date().toISOString(),
      status: 'Completed',
      ...activity
    } as Activity;
    
    setActivities(prev => [newActivity, ...prev]);
    return id;
  };

  const updateActivity = (id: string, updates: Partial<Activity>) => {
    setActivities(prev => prev.map(activity => 
      activity.id === id ? { ...activity, ...updates } : activity
    ));
  };

  const updateActiveSession = (endTime: string, duration: string) => {
    setActivities(prev => prev.map(activity => {
      // More robust check: any active session
      if (activity.status === 'Active' && activity.type === 'SESSION') {
        return {
          ...activity,
          status: 'Completed',
          endTime,
          duration
        };
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
