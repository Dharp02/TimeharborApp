'use client';

import { Home, Users, Clock, Ticket, Settings } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function BottomNav() {
  const pathname = usePathname();

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
          <Link href="/dashboard/clock-in">
            <button className="flex flex-col items-center justify-center w-14 h-14 rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 transition-colors ring-4 ring-white dark:ring-gray-800">
              <Clock className="w-7 h-7" />
            </button>
          </Link>
          <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] font-medium text-blue-600 dark:text-blue-400 whitespace-nowrap">
            Clock In
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
