'use client';

import { Clock, StopCircle } from 'lucide-react';
import { useClockIn } from './ClockInContext';
import { useTeam } from './TeamContext';

export default function DesktopFooter() {
  const { isSessionActive, sessionDuration, sessionFormat, toggleSession } = useClockIn();
  const { currentTeam } = useTeam();

  return (
    <div className="hidden md:flex fixed bottom-0 right-0 left-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4 justify-center items-center z-30 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
      <div className="relative flex items-center gap-4">
        <button
          onClick={() => toggleSession(currentTeam?.id)}
          className={`flex items-center justify-center rounded-full transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5 ${
            isSessionActive
              ? 'bg-red-500 text-white hover:bg-red-600 animate-pulse w-14 h-14'
              : 'bg-blue-600 text-white hover:bg-blue-700 w-14 h-14'
          }`}
        >
          {isSessionActive ? (
            <div className="flex flex-col items-center">
              <span className="font-mono font-bold text-xs leading-none">{sessionDuration}</span>
              <span className="text-[9px] font-medium opacity-80 leading-none mt-0.5">{sessionFormat}</span>
            </div>
          ) : (
            <Clock className="w-7 h-7" />
          )}
        </button>
        <div className="flex flex-col">
          <span className="text-sm font-bold text-gray-900 dark:text-white">
            {isSessionActive ? 'Session Active' : 'Ready to Work?'}
          </span>
          <span className={`text-xs font-medium ${
            isSessionActive ? 'text-red-500' : 'text-blue-600 dark:text-blue-400'
          }`}>
            {isSessionActive ? 'Click to Clock Out' : 'Click to Clock In'}
          </span>
        </div>
      </div>
    </div>
  );
}
