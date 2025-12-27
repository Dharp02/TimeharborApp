'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

type ClockInContextType = {
  isClockedIn: boolean;
  startTime: number | null;
  duration: string;
  format: string;
  toggleClockIn: () => void;
};

const ClockInContext = createContext<ClockInContextType | undefined>(undefined);

export function ClockInProvider({ children }: { children: React.ReactNode }) {
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [duration, setDuration] = useState('00:00');
  const [format, setFormat] = useState('mm:ss');

  useEffect(() => {
    // Load state from local storage on mount
    const storedStartTime = localStorage.getItem('clockInStartTime');
    if (storedStartTime) {
      setStartTime(parseInt(storedStartTime, 10));
      setIsClockedIn(true);
    }
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isClockedIn && startTime) {
      interval = setInterval(() => {
        const now = Date.now();
        const diff = now - startTime;
        
        const hours = Math.floor(diff / 3600000);
        const minutes = Math.floor((diff % 3600000) / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);

        // Show mm:ss for the first minute, then hh:mm
        if (diff < 60000) {
          setDuration(
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
          );
          setFormat('mm:ss');
        } else {
          setDuration(
            `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
          );
          setFormat('hh:mm');
        }
      }, 1000);
    } else {
      setDuration('00:00');
      setFormat('mm:ss');
    }

    return () => clearInterval(interval);
  }, [isClockedIn, startTime]);

  const toggleClockIn = () => {
    if (isClockedIn) {
      // Clock Out
      setIsClockedIn(false);
      setStartTime(null);
      localStorage.removeItem('clockInStartTime');
      // Here you would typically make an API call to record the clock out
    } else {
      // Clock In
      const now = Date.now();
      setIsClockedIn(true);
      setStartTime(now);
      localStorage.setItem('clockInStartTime', now.toString());
      // Here you would typically make an API call to record the clock in
    }
  };

  return (
    <ClockInContext.Provider value={{ isClockedIn, startTime, duration, format, toggleClockIn }}>
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
