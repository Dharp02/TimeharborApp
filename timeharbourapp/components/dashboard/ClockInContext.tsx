'use client';

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { localTimeStore } from '@/TimeharborAPI/time/LocalTimeStore';
import { TimeService } from '@/TimeharborAPI/time/TimeService';
import { useAuth } from '@/components/auth/AuthProvider';
import { Network } from '@capacitor/network';

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
  toggleTicketTimer: (ticketId: string, ticketTitle: string, teamId?: string, comment?: string) => void;
  getFormattedTotalTime: (ticketId: string) => string;
};

const ClockInContext = createContext<ClockInContextType | undefined>(undefined);

export function ClockInProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  
  // Sync Lock
  const isSyncingRef = useRef(false);
  
  // Session State
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [sessionDuration, setSessionDuration] = useState('00:00');
  const [sessionFormat, setSessionFormat] = useState('mm:ss');

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

    // Network listener for auto-sync
    const setupNetworkListener = async () => {
      const status = await Network.getStatus();
      if (status.connected) {
        await attemptSync();
      }

      Network.addListener('networkStatusChange', async (status) => {
        if (status.connected) {
          await attemptSync();
        }
      });
    };
    
    setupNetworkListener();

    return () => {
      Network.removeAllListeners();
    };
  }, []);

  const attemptSync = async () => {
    // Prevent concurrent syncs
    if (isSyncingRef.current) return;

    try {
      isSyncingRef.current = true;
      const events = await localTimeStore.getPendingEvents();
      if (events.length > 0) {
        await TimeService.syncTimeData(events);
        await localTimeStore.clearEvents(events.map(e => e.id));
        console.log('Synced offline time data successfully');
      }
    } catch (error) {
      console.error('Auto-sync failed:', error);
    } finally {
      isSyncingRef.current = false;
    }
  };

  // Session Timer Effect
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isSessionActive && sessionStartTime) {
      interval = setInterval(() => {
        const now = Date.now();
        const diff = now - sessionStartTime;
        
        const hours = Math.floor(diff / 3600000);
        const minutes = Math.floor((diff % 3600000) / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);

        if (diff < 60000) {
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
        const now = Date.now();
        const diff = now - ticketStartTime;
        
        const hours = Math.floor(diff / 3600000);
        const minutes = Math.floor((diff % 3600000) / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);

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
      // Clock Out Session
      setIsSessionActive(false);
      setSessionStartTime(null);
      localStorage.removeItem('sessionStartTime');
      
      // Also stop any active ticket and save its duration
      if (activeTicketId && ticketStartTime) {
        const now = Date.now();
        const sessionDuration = now - ticketStartTime;
        const currentTotal = ticketDurations[activeTicketId] || 0;
        const newTotal = currentTotal + sessionDuration;
        
        const updatedDurations = { ...ticketDurations, [activeTicketId]: newTotal };
        setTicketDurations(updatedDurations);
        localStorage.setItem('ticketDurations', JSON.stringify(updatedDurations));

        // Stop the ticket first
        await localTimeStore.stopTicket(user.id, activeTicketId, 'Session ended', activeTicketTeamId);

        setActiveTicketId(null);
        setActiveTicketTitle(null);
        setActiveTicketTeamId(null);
        setTicketStartTime(null);
        localStorage.removeItem('activeTicketId');
        localStorage.removeItem('activeTicketTitle');
        localStorage.removeItem('activeTicketTeamId');
        localStorage.removeItem('ticketStartTime');
      }

      // Then clock out
      await localTimeStore.clockOut(user.id, null, teamId || null);

      // Attempt to sync immediately
      await attemptSync();

    } else {
      // Clock In Session
      const now = Date.now();
      setIsSessionActive(true);
      setSessionStartTime(now);
      localStorage.setItem('sessionStartTime', now.toString());

      await localTimeStore.clockIn(user.id, teamId || null);

      // Attempt to sync immediately
      await attemptSync();
    }
  };

  const toggleTicketTimer = async (ticketId: string, ticketTitle: string, teamId?: string, comment?: string) => {
    if (!isSessionActive) return; // Cannot start ticket timer if session is not active
    if (!user?.id) {
      console.error('Cannot toggle ticket: Missing user');
      return;
    }

    if (activeTicketId === ticketId) {
      // Stop current ticket (activeTicketId === ticketId)
      
      // Save duration logic
      if (ticketStartTime) {
        const now = Date.now();
        const sessionDuration = now - ticketStartTime;
        const currentTotal = ticketDurations[ticketId] || 0;
        const newTotal = currentTotal + sessionDuration;
        
        const updatedDurations = { ...ticketDurations, [ticketId]: newTotal };
        setTicketDurations(updatedDurations);
        localStorage.setItem('ticketDurations', JSON.stringify(updatedDurations));
      }

      await localTimeStore.stopTicket(user.id, ticketId, comment, activeTicketTeamId);

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
      
      // If there was an active ticket, save its duration first
      if (activeTicketId && ticketStartTime) {
        const now = Date.now();
        const sessionDuration = now - ticketStartTime;
        const currentTotal = ticketDurations[activeTicketId] || 0;
        const newTotal = currentTotal + sessionDuration;
        
        const updatedDurations = { ...ticketDurations, [activeTicketId]: newTotal };
        setTicketDurations(updatedDurations);
        localStorage.setItem('ticketDurations', JSON.stringify(updatedDurations));
        
        // Stop the previous ticket
        await localTimeStore.stopTicket(user.id, activeTicketId, comment, activeTicketTeamId);
      }

      await localTimeStore.startTicket(user.id, ticketId, ticketTitle, teamId || null);

      // Start new ticket state
      const now = Date.now();
      setActiveTicketId(ticketId);
      setActiveTicketTitle(ticketTitle);
      setActiveTicketTeamId(teamId || null);
      setTicketStartTime(now);
      localStorage.setItem('activeTicketId', ticketId);
      localStorage.setItem('activeTicketTitle', ticketTitle);
      if (teamId) localStorage.setItem('activeTicketTeamId', teamId);
      localStorage.setItem('ticketStartTime', now.toString());
    }

    // Attempt to sync immediately
    await attemptSync();
  };

  const getFormattedTotalTime = (ticketId: string) => {
    const totalMs = ticketDurations[ticketId] || 0;
    const hours = Math.floor(totalMs / 3600000);
    const minutes = Math.floor((totalMs % 3600000) / 60000);
    const seconds = Math.floor((totalMs % 60000) / 1000);
    
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
