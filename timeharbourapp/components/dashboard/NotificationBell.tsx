'use client';

import { Bell } from 'lucide-react';
import Link from 'next/link';
import { useNotifications } from '@/contexts/NotificationContext';

export default function NotificationBell({ isMobile = false }) {
  const { unreadCount } = useNotifications();

  return (
    <Link
      href="/dashboard/notifications"
      className="p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors relative"
      aria-label="Notifications"
    >
      <Bell className="w-5 h-5" />
      {unreadCount > 0 && (
        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white dark:ring-gray-800" />
      )}
    </Link>
  );
}
