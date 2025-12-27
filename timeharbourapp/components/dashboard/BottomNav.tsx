'use client';

import { Home, Users, Clock, Ticket, Settings, StopCircle } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useClockIn } from './ClockInContext';

export default function BottomNav() {
  const pathname = usePathname();
  const { isClockedIn, duration, format, toggleClockIn } = useClockIn();

  const isActive = (path: string) => pathname === path;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 pb-safe md:hidden">
      <div className="flex items-center justify-around h-16 px-2">
        <Link
          href="/dashboard"
          className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${
            isActive('/dashboard') ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          <Home className="w-6 h-6" />
          <span className="text-[10px] font-medium">Home</span>
        </Link>

        <Link
          href="/dashboard/teams"
          className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${
            isActive('/dashboard/teams') ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          <Users className="w-6 h-6" />
          <span className="text-[10px] font-medium">Teams</span>
        </Link>

        <div className="relative -top-5">
          <button 
            onClick={toggleClockIn}
            className={`flex flex-col items-center justify-center rounded-full text-white shadow-lg transition-all ring-4 ring-white dark:ring-gray-800 ${
              isClockedIn 
                ? 'bg-red-500 hover:bg-red-600 animate-pulse w-16 h-16' 
                : 'bg-blue-600 hover:bg-blue-700 w-14 h-14'
            }`}
          >
            {isClockedIn ? (
              <>
                <span className="text-xs font-bold font-mono leading-none">{duration}</span>
                <span className="text-[8px] font-medium opacity-80 leading-none mt-0.5">{format}</span>
              </>
            ) : (
              <Clock className="w-8 h-8" />
            )}
          </button>
          <span className={`absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] font-medium whitespace-nowrap ${
            isClockedIn ? 'text-red-500' : 'text-blue-600 dark:text-blue-400'
          }`}>
            {isClockedIn ? 'Clock Out' : 'Clock In'}
          </span>
        </div>

        <Link
          href="/dashboard/tickets"
          className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${
            isActive('/dashboard/tickets') ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          <Ticket className="w-6 h-6" />
          <span className="text-[10px] font-medium">Ticket</span>
        </Link>

        <Link
          href="/dashboard/settings"
          className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${
            isActive('/dashboard/settings') ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          <Settings className="w-6 h-6" />
          <span className="text-[10px] font-medium">Settings</span>
        </Link>
      </div>
    </div>
  );
}
