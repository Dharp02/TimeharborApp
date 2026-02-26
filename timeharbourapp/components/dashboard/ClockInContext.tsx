'use client';

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { localTimeStore } from '@/TimeharborAPI/time/LocalTimeStore';
import { syncManager } from '@/TimeharborAPI/SyncManager';
import { TimeService } from '@/TimeharborAPI/time/TimeService';
import { useAuth } from '@/components/auth/AuthProvider';
import { Network } from '@capacitor/network';
import { Modal } from '@/components/ui/Modal';
import { useActivityLog } from './ActivityLogContext';
import { DateTime, Duration } from 'luxon';

type ClockInContextType = {
  // Global Session
  isSessionActive: boolean;
  sessionStartTime: number | null;
  sessionDuration: string;
  sessionFormat: string;
  
  // Ticket Timer
  activeTicketId: string | null;
  activeTicketTitle: string | null;
  activeTicketTeamId: string | null;
  ticketStartTime: number | null;
  ticketDuration: string;
  ticketFormat: string;
  ticketDurations: Record<string, number>;

  // Actions
  toggleSession: (teamId?: string) => void;
  toggleTicketTimer: (ticketId: string, ticketTitle: string, teamId?: string, comment?: string, link?: string) => void;
  getFormattedTotalTime: (ticketId: string) => string;
};

const ClockInContext = createContext<ClockInContextType | undefined>(undefined);

export function ClockInProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { addActivity, updateActiveSession } = useActivityLog();
  
  // Session State
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [sessionDuration, setSessionDuration] = useState('00:00');
  const [sessionFormat, setSessionFormat] = useState('mm:ss');

  // Ticket Stop Modal State
  const [isStopTicketModalOpen, setIsStopTicketModalOpen] = useState(false);
  const [stopTicketComment, setStopTicketComment] = useState('');
  const [stopTicketLink, setStopTicketLink] = useState('');
  const [pendingSessionStopTeamId, setPendingSessionStopTeamId] = useState<string | undefined>(undefined);

  // Ticket State
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
  const [activeTicketTitle, setActiveTicketTitle] = useState<string | null>(null);
  const [activeTicketTeamId, setActiveTicketTeamId] = useState<string | null>(null);
  const [ticketStartTime, setTicketStartTime] = useState<number | null>(null);
  const [ticketDuration, setTicketDuration] = useState('00:00');
  const [ticketFormat, setTicketFormat] = useState('mm:ss');
  const [ticketDurations, setTicketDurations] = useState<Record<string, number>>({});

  useEffect(() => {
    // Load state from local storage on mount
    const storedSessionStart = localStorage.getItem('sessionStartTime');
    const storedTicketStart = localStorage.getItem('ticketStartTime');
    const storedTicketId = localStorage.getItem('activeTicketId');
    const storedTicketTitle = localStorage.getItem('activeTicketTitle');
    const storedTicketTeamId = localStorage.getItem('activeTicketTeamId');
    const storedDurations = localStorage.getItem('ticketDurations');
    
    if (storedSessionStart) {
      setSessionStartTime(parseInt(storedSessionStart, 10));
      setIsSessionActive(true);
    }

    if (storedTicketStart && storedTicketId) {
      setTicketStartTime(parseInt(storedTicketStart, 10));
      setActiveTicketId(storedTicketId);
      if (storedTicketTitle) setActiveTicketTitle(storedTicketTitle);
      if (storedTicketTeamId) setActiveTicketTeamId(storedTicketTeamId);
    }

    if (storedDurations) {
      try {
        setTicketDurations(JSON.parse(storedDurations));
      } catch (e) {
        console.error('Failed to parse ticket durations', e);
      }
    }

    // Network listener removed - handled by SyncManager
  }, []);

  // Sync state with activity logs
  const { activities } = useActivityLog();
  
  useEffect(() => {
    if (!user?.id || activities.length === 0) return;

    // Find the most recent session activity
    const recentSession = activities.find(a => a.type === 'SESSION' && (a.title === 'Work Session Started' || a.title === 'Session Ended'));
    
    if (recentSession) {
      if (recentSession.status === 'Active' && recentSession.title === 'Work Session Started') {
        // Session is active on backend
        const startTime = new Date(recentSession.startTime).getTime();
        if (!isSessionActive || sessionStartTime !== startTime) {
          setIsSessionActive(true);
          setSessionStartTime(startTime);
          localStorage.setItem('sessionStartTime', startTime.toString());
        }
      } else if (recentSession.status === 'Completed' && recentSession.title === 'Session Ended') {
        // Session is ended on backend
        if (isSessionActive) {
          setIsSessionActive(false);
          setSessionStartTime(null);
          localStorage.removeItem('sessionStartTime');
        }
      }
    }

    // Find the most recent ticket activity
    const recentTicket = activities.find(a => a.type === 'SESSION' && (a.title === 'Started Ticket' || a.title === 'Stopped Ticket'));
    
    if (recentTicket) {
      if (recentTicket.status === 'Active' && recentTicket.title === 'Started Ticket') {
        // Ticket is active on backend
        const startTime = new Date(recentTicket.startTime).getTime();
        
        // If we don't have an active ticket locally, but backend says we do,
        // we try to restore it. We need the ticket ID, which we might have to guess
        // or extract if it was saved in the activity. For now, we'll just set the start time
        // if the local storage has the matching title.
        if (!activeTicketId && recentTicket.subtitle) {
           const storedTicketId = localStorage.getItem('activeTicketId');
           const storedTicketTitle = localStorage.getItem('activeTicketTitle');
           
           if (storedTicketId && storedTicketTitle === recentTicket.subtitle) {
             setActiveTicketId(storedTicketId);
             setActiveTicketTitle(storedTicketTitle);
             setTicketStartTime(startTime);
             localStorage.setItem('ticketStartTime', startTime.toString());
           }
        } else if (activeTicketId && ticketStartTime !== startTime) {
           // Update start time if it differs
           setTicketStartTime(startTime);
           localStorage.setItem('ticketStartTime', startTime.toString());
        }
      } else if (recentTicket.status === 'Completed' && recentTicket.title === 'Stopped Ticket') {
        // Ticket is stopped on backend
        if (activeTicketId) {
          setActiveTicketId(null);
          setActiveTicketTitle(null);
          setActiveTicketTeamId(null);
          setTicketStartTime(null);
          localStorage.removeItem('activeTicketId');
          localStorage.removeItem('activeTicketTitle');
          localStorage.removeItem('activeTicketTeamId');
          localStorage.removeItem('ticketStartTime');
        }
      }
    }
  }, [activities, user?.id, isSessionActive, sessionStartTime, activeTicketId, ticketStartTime]);



  // Session Timer Effect
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isSessionActive && sessionStartTime) {
      interval = setInterval(() => {
        const start = DateTime.fromMillis(sessionStartTime);
        const now = DateTime.now();
        const diff = now.diff(start, ['hours', 'minutes', 'seconds']);
        
        // Remove milliseconds from object for cleaner display
        const totalDuration = diff.normalize();

        const hours = Math.floor(totalDuration.hours);
        const minutes = Math.floor(totalDuration.minutes);
        const seconds = Math.floor(totalDuration.seconds);

        if (totalDuration.as('minutes') < 60 && hours === 0) {
          setSessionDuration(
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
          );
          setSessionFormat('mm:ss');
        } else {
          setSessionDuration(
            `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
          );
          setSessionFormat('hh:mm');
        }
      }, 1000);
    } else {
      setSessionDuration('00:00');
      setSessionFormat('mm:ss');
    }

    return () => clearInterval(interval);
  }, [isSessionActive, sessionStartTime]);

  // Ticket Timer Effect
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (activeTicketId && ticketStartTime) {
      interval = setInterval(() => {
        const start = DateTime.fromMillis(ticketStartTime);
        const now = DateTime.now();
        const diff = now.diff(start, ['hours', 'minutes', 'seconds']);
        const totalDuration = diff.normalize();
        
        const hours = Math.floor(totalDuration.hours);
        const minutes = Math.floor(totalDuration.minutes);
        const seconds = Math.floor(totalDuration.seconds);

        setTicketDuration(
          `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        );
        setTicketFormat('hh:mm:ss');
      }, 1000);
    } else {
      setTicketDuration('00:00:00');
      setTicketFormat('hh:mm:ss');
    }

    return () => clearInterval(interval);
  }, [activeTicketId, ticketStartTime]);

  const toggleSession = async (teamId?: string) => {
    if (!user?.id) {
      console.error('Cannot toggle session: User not logged in');
      return;
    }

    if (isSessionActive) {
      // Check if ticket is running
      if (activeTicketId) {
        setPendingSessionStopTeamId(teamId);
        setIsStopTicketModalOpen(true);
        return;
      }

      // Clock Out Session
      setIsSessionActive(false);
      setSessionStartTime(null);
      localStorage.removeItem('sessionStartTime');
      
      const now = DateTime.now();
      const startTime = sessionStartTime ? DateTime.fromMillis(sessionStartTime) : now;
      const duration = now.diff(startTime, ['hours', 'minutes', 'seconds']).normalize();
      
      const hours = Math.floor(duration.hours);
      const minutes = Math.floor(duration.minutes);
      const seconds = Math.floor(duration.seconds);

      // Store with seconds for accuracy
      const durationStr = `${hours}h ${minutes}m ${seconds}s`; // Luxon seconds are likely floating point, but floor takes care of it

      updateActiveSession(now.toISO() || new Date().toISOString(), durationStr);

      addActivity({
        type: 'SESSION',
        title: 'Session Ended',
        subtitle: `Duration: ${durationStr}`,
        status: 'Completed',
        duration: durationStr
      });
      
      // Then clock out
      await localTimeStore.clockOut(user.id, null, teamId || null);

      // Attempt to sync immediately
      await syncManager.syncNow();
      
      // Force reload activities to ensure sync
      window.dispatchEvent(new Event('pull-to-refresh'));

      // 🔄 FORCE REFRESH DASHBOARD STATS
      // This event listener should be picked up by DashboardSummary to refetch API
      window.dispatchEvent(new CustomEvent('dashboard-stats-refresh'));
    } else {
      // Clock In Session
      const now = DateTime.now();
      setIsSessionActive(true);
      setSessionStartTime(now.toMillis());
      localStorage.setItem('sessionStartTime', now.toMillis().toString());

      addActivity({
        type: 'SESSION',
        title: 'Work Session Started',
        subtitle: 'Clocked In',
        status: 'Active',
        duration: '0h 0m',
        startTime: now.toISO() || new Date().toISOString()
      });

      await localTimeStore.clockIn(user.id, teamId || null);

      // Attempt to sync immediately
      await syncManager.syncNow();
      
      // Force reload activities to ensure sync
      window.dispatchEvent(new Event('pull-to-refresh'));
    }
  };

  const confirmStopTicketAndSession = async () => {
    if (!user?.id) return;

    // First stop the ticket
    if (activeTicketId && ticketStartTime) {
      const now = DateTime.now();
      const start = DateTime.fromMillis(ticketStartTime);
      const sessionDuration = now.diff(start).as('milliseconds'); // Keep as ms for ticketDurations arithmetic
      
      const currentTotal = ticketDurations[activeTicketId] || 0;
      const newTotal = currentTotal + sessionDuration;
      
      const updatedDurations = { ...ticketDurations, [activeTicketId]: newTotal };
      setTicketDurations(updatedDurations);
      localStorage.setItem('ticketDurations', JSON.stringify(updatedDurations));

      // NEW: Add activity log for the stopped ticket
       const durationObj = DateTime.now().diff(DateTime.fromMillis(ticketStartTime), ['hours', 'minutes', 'seconds']).normalize();
       const hours = Math.floor(durationObj.hours);
       const minutes = Math.floor(durationObj.minutes);
       const seconds = Math.floor(durationObj.seconds);
       const durationStr = `${hours}h ${minutes}m ${seconds}s`;

      addActivity({
        type: 'SESSION',
        title: 'Stopped Ticket',
        subtitle: activeTicketTitle || 'Ticket',
        description: stopTicketComment,
        link: stopTicketLink || undefined,
        status: 'Completed',
        duration: durationStr
      });

      // Stop the ticket
      await localTimeStore.stopTicket(user.id, activeTicketId, stopTicketComment, activeTicketTeamId, stopTicketLink || null);

      setActiveTicketId(null);
      setActiveTicketTitle(null);
      setActiveTicketTeamId(null);
      setTicketStartTime(null);
      localStorage.removeItem('activeTicketId');
      localStorage.removeItem('activeTicketTitle');
      localStorage.removeItem('activeTicketTeamId');
      localStorage.removeItem('ticketStartTime');
    }

    // Then clock out session
    setIsSessionActive(false);
    setSessionStartTime(null);
    localStorage.removeItem('sessionStartTime');

    const now = DateTime.now();
    const startTimeMs = sessionStartTime || now.toMillis();
    const startTime = DateTime.fromMillis(startTimeMs);
    
    // Use Luxon duration
    const duration = now.diff(startTime, ['hours', 'minutes', 'seconds']).normalize();
    
    const hours = Math.floor(duration.hours);
    const minutes = Math.floor(duration.minutes);
    const seconds = Math.floor(duration.seconds);
    const durationStr = `${hours}h ${minutes}m ${seconds}s`;

    updateActiveSession(now.toISO() || new Date().toISOString(), durationStr);

    addActivity({
        type: 'SESSION',
        title: 'Session Ended',
        subtitle: `Duration: ${durationStr}`,
        status: 'Completed',
        duration: durationStr
    });

    await localTimeStore.clockOut(user.id, stopTicketComment || null, pendingSessionStopTeamId || null);

    // Attempt to sync immediately
    await syncManager.syncNow();
    
    // Force reload activities to ensure sync
    window.dispatchEvent(new Event('pull-to-refresh'));
    
    // Reset Modal
    setIsStopTicketModalOpen(false);
    setStopTicketComment('');
    setStopTicketLink('');
    setPendingSessionStopTeamId(undefined);

    // 🔄 FORCE REFRESH DASHBOARD STATS
    // This event listener should be picked up by DashboardSummary to refetch API
    window.dispatchEvent(new CustomEvent('dashboard-stats-refresh'));
  };

  const cancelStopTicketAndSession = () => {
    setIsStopTicketModalOpen(false);
    setStopTicketComment('');
    setStopTicketLink('');
    setPendingSessionStopTeamId(undefined);
  };



  const toggleTicketTimer = async (ticketId: string, ticketTitle: string, teamId?: string, comment?: string, link?: string) => {
    if (!isSessionActive) return; // Cannot start ticket timer if session is not active
    if (!user?.id) {
      console.error('Cannot toggle ticket: Missing user');
      return;
    }

    if (activeTicketId === ticketId) {
      // Stop current ticket (activeTicketId === ticketId)
      
      const now = DateTime.now();

      // Save duration logic
      if (ticketStartTime) {
        const start = DateTime.fromMillis(ticketStartTime);
        const duration = now.diff(start, ['hours', 'minutes', 'seconds']).normalize();
        
        const currentTotal = ticketDurations[ticketId] || 0;
        const newTotal = currentTotal + duration.as('milliseconds'); // Use milliseconds for state storage
        
        const updatedDurations = { ...ticketDurations, [ticketId]: newTotal };
        setTicketDurations(updatedDurations);
        localStorage.setItem('ticketDurations', JSON.stringify(updatedDurations));
        
        const hours = Math.floor(duration.hours);
        const minutes = Math.floor(duration.minutes);
        const seconds = Math.floor(duration.seconds);
        const durationStr = `${hours}h ${minutes}m ${seconds}s`;
        
        addActivity({
            type: 'SESSION',
            title: 'Stopped Ticket',
            subtitle: activeTicketTitle || 'Ticket',
            description: comment, // Description visible
            link: link || undefined,
            status: 'Completed',
            duration: durationStr
        });
      }

      await localTimeStore.stopTicket(user.id, ticketId, comment, activeTicketTeamId, link || null);

      // Clear active ticket state
      setActiveTicketId(null);
      setActiveTicketTitle(null);
      setActiveTicketTeamId(null);
      setTicketStartTime(null);
      localStorage.removeItem('activeTicketId');
      localStorage.removeItem('activeTicketTitle');
      localStorage.removeItem('activeTicketTeamId');
      localStorage.removeItem('ticketStartTime');
    } else {
      // Starting Ticket (activeTicketId !== ticketId)
      const now = DateTime.now();
      
      // Stop the previous ticket
      if (activeTicketId && ticketStartTime) {
        const start = DateTime.fromMillis(ticketStartTime);
        const sessionDuration = now.diff(start, ['hours', 'minutes', 'seconds']).normalize();
        
        const currentTotal = ticketDurations[activeTicketId] || 0;
        const newTotal = currentTotal + sessionDuration.as('milliseconds');
        
        const updatedDurations = { ...ticketDurations, [activeTicketId]: newTotal };
        setTicketDurations(updatedDurations);
        localStorage.setItem('ticketDurations', JSON.stringify(updatedDurations));
        
        const hours = Math.floor(sessionDuration.hours);
        const minutes = Math.floor(sessionDuration.minutes);
        const seconds = Math.floor(sessionDuration.seconds);
        const durationStr = `${hours}h ${minutes}m ${seconds}s`;

        addActivity({
            type: 'SESSION',
            title: 'Stopped Ticket',
            subtitle: activeTicketTitle || 'Ticket',
            description: comment || 'Switched task',
            link: link || undefined,
            status: 'Completed',
            duration: durationStr
        });

        // Stop the previous ticket
        await localTimeStore.stopTicket(user.id, activeTicketId, comment, activeTicketTeamId, link || null);
      } else if (activeTicketId) {
        await localTimeStore.stopTicket(user.id, activeTicketId, comment, activeTicketTeamId, link || null);
      }

      await localTimeStore.startTicket(user.id, ticketId, ticketTitle, teamId || null);

      addActivity({
        type: 'SESSION',
        title: 'Started Ticket',
        subtitle: ticketTitle,
        status: 'Active',
        duration: '0m',
        startTime: now.toISO() || new Date().toISOString()
      });

      // Start new ticket state
      setActiveTicketId(ticketId);
      setActiveTicketTitle(ticketTitle);
      setActiveTicketTeamId(teamId || null);
      setTicketStartTime(now.toMillis());
      localStorage.setItem('activeTicketId', ticketId);
      localStorage.setItem('activeTicketTitle', ticketTitle);
      if (teamId) localStorage.setItem('activeTicketTeamId', teamId);
      localStorage.setItem('ticketStartTime', now.toMillis().toString());
    }

    // Attempt to sync immediately
    await syncManager.syncNow(); 
    // Force reload activities to ensure sync
    window.dispatchEvent(new Event('pull-to-refresh'));  };

  const getFormattedTotalTime = (ticketId: string) => {
    const totalMs = ticketDurations[ticketId] || 0;
    const duration = Duration.fromMillis(totalMs).shiftTo('hours', 'minutes', 'seconds');
    
    // Normalize to handle overflows like 61 seconds -> 1 minute 1 second
    const normalized = duration.normalize();

    const hours = Math.floor(normalized.hours);
    const minutes = Math.floor(normalized.minutes);
    const seconds = Math.floor(normalized.seconds);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  return (
    <ClockInContext.Provider value={{ 
      isSessionActive, 
      sessionStartTime, 
      sessionDuration, 
      sessionFormat,
      activeTicketId, 
      activeTicketTitle,
      activeTicketTeamId,
      ticketStartTime,
      ticketDuration,
      ticketFormat,
      ticketDurations,
      toggleSession, 
      toggleTicketTimer,
      getFormattedTotalTime
    }}>
      {children}
      <Modal
        isOpen={isStopTicketModalOpen}
        onClose={cancelStopTicketAndSession}
        title={`Stop working on "${activeTicketTitle || 'Ticket'}"?`}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            You are clocking out but the ticket timer is still running. Please add a comment to stop the ticket and clock out.
          </p>
          <textarea
            value={stopTicketComment}
            onChange={(e) => setStopTicketComment(e.target.value)}
            placeholder="What did you work on?"
            className="w-full h-32 p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            autoFocus
          />
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Link (optional)</label>
            <input
              type="url"
              value={stopTicketLink}
              onChange={(e) => setStopTicketLink(e.target.value)}
              placeholder="Paste a YouTube or Pulse link..."
              className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>
          <div className="flex justify-end gap-3">
            <button
              onClick={cancelStopTicketAndSession}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={confirmStopTicketAndSession}
              className="px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors bg-blue-600 hover:bg-blue-700"
            >
              Stop & Clock Out
            </button>
          </div>
        </div>
      </Modal>
    </ClockInContext.Provider>
  );
}

export function useClockIn() {
  const context = useContext(ClockInContext);
  if (context === undefined) {
    throw new Error('useClockIn must be used within a ClockInProvider');
  }
  return context;
}
