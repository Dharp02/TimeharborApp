'use client';

import { Clock, StopCircle } from 'lucide-react';
import { useClockIn } from './ClockInContext';

export default function DesktopFooter() {
  const { isSessionActive, sessionDuration, sessionFormat, toggleSession } = useClockIn();

  return (
    <div className="hidden md:flex fixed bottom-0 right-0 left-64 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4 pb-6 justify-center items-center z-30 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
      <div className="relative">
        <button
          onClick={toggleSession}
          className={`flex flex-col items-center justify-center rounded-full transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5 ${
            isSessionActive
              ? 'bg-red-500 text-white hover:bg-red-600 animate-pulse w-20 h-20'
              : 'bg-blue-600 text-white hover:bg-blue-700 w-16 h-16'
          }`}
        >
          {isSessionActive ? (
            <>
              <span className="font-mono font-bold text-sm leading-none">{sessionDuration}</span>
              <span className="text-[10px] font-medium opacity-80 leading-none mt-0.5">{sessionFormat}</span>
            </>
          ) : (
            <Clock className="w-10 h-10" />
          )}
        </button>
        <span className={`absolute -bottom-5 left-1/2 -translate-x-1/2 text-xs font-medium whitespace-nowrap ${
          isSessionActive ? 'text-red-500' : 'text-blue-600 dark:text-blue-400'
        }`}>
          {isSessionActive ? 'Clock Out' : 'Clock In'}
        </span>
      </div>
    </div>
  );
}
