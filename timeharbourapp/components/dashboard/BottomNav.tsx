'use client';

import { Home, Users, Clock, Ticket, Menu, Coffee } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useClockIn } from './ClockInContext';
import { useTeam } from './TeamContext';

export default function BottomNav() {
  const pathname = usePathname();
  const { isSessionActive, isOnBreak, sessionDuration, sessionFormat, toggleSession, resumeFromBreak } = useClockIn();
  const { refreshTeams, currentTeam } = useTeam();

  const isActive = (path: string) => {
    if (path === '/dashboard') return pathname === '/dashboard';
    return pathname?.startsWith(path);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 pb-safe md:hidden">
      <div className="flex items-center justify-around h-20 px-2">
        <Link
          href="/dashboard"
          className="flex flex-col items-center justify-center w-full h-full"
        >
          <div className={`p-1.5 rounded-xl transition-all duration-200 ${
            isActive('/dashboard') 
              ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400' 
              : 'text-gray-500 dark:text-gray-400'
          }`}>
            <Home className="w-6 h-6" />
          </div>
          <span className={`text-[10px] font-medium mt-1 ${
            isActive('/dashboard') ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'
          }`}>Home</span>
        </Link>
        
        <Link
          href="/dashboard/teams"
          onClick={() => refreshTeams()}
          className="flex flex-col items-center justify-center w-full h-full"
        >
          <div className={`p-1.5 rounded-xl transition-all duration-200 ${
            isActive('/dashboard/teams') 
              ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400' 
              : 'text-gray-500 dark:text-gray-400'
          }`}>
            <Users className="w-6 h-6" />
          </div>
          <span className={`text-[10px] font-medium mt-1 ${
            isActive('/dashboard/teams') ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'
          }`}>Teams</span>
        </Link>

        <div className="relative -top-5">
          <button 
            onClick={() => isOnBreak ? resumeFromBreak() : toggleSession(currentTeam?.id)}
            className={`flex flex-col items-center justify-center rounded-full text-white shadow-lg transition-all ring-4 ring-white dark:ring-gray-800 ${
              isOnBreak
                ? 'bg-amber-400 hover:bg-amber-500 w-16 h-16'
                : isSessionActive 
                ? 'bg-red-500 hover:bg-red-600 animate-pulse w-17 h-17' 
                : 'bg-blue-600 hover:bg-blue-700 w-16 h-16'
            }`}
          >
            {isOnBreak ? (
              <Coffee className="w-7 h-7" />
            ) : isSessionActive ? (
              <>
                <span className="text-xs font-bold font-mono leading-none">{sessionDuration}</span>
                <span className="text-[8px] font-medium opacity-80 leading-none mt-0.5">{sessionFormat}</span>
              </>
            ) : (
              <Clock className="w-8 h-8" />
            )}
          </button>
          <span className={`absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] font-medium whitespace-nowrap ${
            isOnBreak ? 'text-amber-500' : isSessionActive ? 'text-red-500' : 'text-blue-600 dark:text-blue-400'
          }`}>
            {isOnBreak ? 'On Break' : isSessionActive ? 'Clock Out' : 'Clock In'}
          </span>
        </div>

        <Link
          href="/dashboard/tickets"
          className="flex flex-col items-center justify-center w-full h-full"
        >
          <div className={`p-1.5 rounded-xl transition-all duration-200 ${
            isActive('/dashboard/tickets') 
              ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400' 
              : 'text-gray-500 dark:text-gray-400'
          }`}>
            <Ticket className="w-6 h-6" />
          </div>
          <span className={`text-[10px] font-medium mt-1 ${
            isActive('/dashboard/tickets') ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'
          }`}>Ticket</span>
        </Link>

        <Link
          href="/dashboard/settings"
          className="flex flex-col items-center justify-center w-full h-full"
        >
          <div className={`p-1.5 rounded-xl transition-all duration-200 ${
            isActive('/dashboard/settings') 
              ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400' 
              : 'text-gray-500 dark:text-gray-400'
          }`}>
            <Menu className="w-6 h-6" />
          </div>
          <span className={`text-[10px] font-medium mt-1 ${
            isActive('/dashboard/settings') ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'
          }`}>Menu</span>
        </Link>
      </div>
    </div>
  );
}
