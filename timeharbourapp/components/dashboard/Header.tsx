'use client';

import { Home, Users, Ticket, Settings, LogOut, ArrowRightLeft } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { auth } from '@/TimeharborAPI';

interface HeaderProps {
  onTeamSwitch: () => void;
  currentTeamName: string | null;
}

export default function Header({ onTeamSwitch, currentTeamName }: HeaderProps) {
  const pathname = usePathname();
  const isActive = (path: string) => pathname === path;

  const handleSignOut = async () => {
    try {
      await auth.signOut();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const navItems = [
    { name: 'Home', href: '/dashboard', icon: Home },
    { name: 'Teams', href: '/dashboard/teams', icon: Users },
    { name: 'Tickets', href: '/dashboard/tickets', icon: Ticket },
    { name: 'Settings', href: '/dashboard/settings', icon: Settings },
  ];

  return (
    <header className="hidden md:flex items-center justify-between px-6 py-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 fixed top-0 left-0 right-0 z-40 h-20">
      <div className="flex items-center gap-12">
        <h1 className="text-2xl font-bold text-blue-600 dark:text-blue-400">Timeharbor</h1>
        
        <nav className="flex items-center gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm font-medium ${
                  active
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={onTeamSwitch}
          className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg transition-colors text-sm font-medium border border-gray-200 dark:border-gray-700"
          title="Switch Team"
        >
          <ArrowRightLeft className="w-4 h-4" />
          <span>{currentTeamName || 'Switch Team'}</span>
        </button>
        
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 px-4 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors text-sm font-medium"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </header>
  );
}
