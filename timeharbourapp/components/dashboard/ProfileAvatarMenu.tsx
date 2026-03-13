'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell, ArrowRightLeft, Palette, Sun, Moon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useNotifications } from '@/contexts/NotificationContext';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button, ThemeToggle } from '@mieweb/ui';
import BrandSwitcher from './BrandSwitcher';

interface ProfileAvatarMenuProps {
  onTeamSwitchClick: () => void;
}

export default function ProfileAvatarMenu({ onTeamSwitchClick }: ProfileAvatarMenuProps) {
  const { user } = useAuth();
  const { unreadCount } = useNotifications();
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Get user initials
  const getInitials = () => {
    if (!user?.full_name) return user?.email?.charAt(0).toUpperCase() || 'U';
    const parts = user.full_name.split(' ');
    if (parts.length >= 2) {
      return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }
    return user.full_name.substring(0, 2).toUpperCase();
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  const handleNotificationsClick = () => {
    setIsMenuOpen(false);
    router.push('/dashboard/notifications');
  };

  const handleTeamSwitchClick = () => {
    setIsMenuOpen(false);
    onTeamSwitchClick();
  };

  return (
    <div className="relative" ref={menuRef}>
      {/* Avatar Circle */}
      <Button
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        className="relative w-10 h-10 rounded-full bg-primary-600 dark:bg-primary-500 flex items-center justify-center text-white font-semibold text-sm hover:bg-primary-700 dark:hover:bg-primary-600 transition-colors"
        aria-label="Profile menu"
      >
        {getInitials()}
        {unreadCount > 0 && (
          <span className="absolute -bottom-1 -right-1 min-w-[20px] h-5 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white dark:ring-gray-800">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </Button>

      {/* Dropdown Menu */}
      {isMenuOpen && (
        <div className="absolute right-0 top-12 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          <Button
            variant="ghost"
            onClick={handleNotificationsClick}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors border-b border-gray-100 dark:border-gray-700"
          >
            <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
              <Bell className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div className="flex-1 text-left">
              <div className="font-medium text-gray-900 dark:text-white">Notifications</div>
              {unreadCount > 0 && (
                <div className="text-xs text-gray-500 dark:text-gray-400">{unreadCount} unread</div>
              )}
            </div>
          </Button>

          <Button
            variant="ghost"
            onClick={handleTeamSwitchClick}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors border-b border-gray-100 dark:border-gray-700"
          >
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <ArrowRightLeft className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div className="flex-1 text-left">
              <div className="font-medium text-gray-900 dark:text-white">Switch Team</div>
            </div>
          </Button>

          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                  <Sun className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="font-medium text-gray-900 dark:text-white">Mode</div>
              </div>
              <ThemeToggle mode="three-way" size="sm" variant="ghost" />
            </div>
          </div>

          <div className="px-4 py-3">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
                <Palette className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              </div>
              <div className="font-medium text-gray-900 dark:text-white">Brand</div>
            </div>
            <BrandSwitcher variant="inline" />
          </div>
        </div>
      )}
    </div>
  );
}
