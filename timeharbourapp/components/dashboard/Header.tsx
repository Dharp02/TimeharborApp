'use client';

import NotificationBell from './NotificationBell';
import { ThemeToggle } from '@mieweb/ui';

export default function Header() {
  return (
    <header className="hidden lg:flex items-center justify-end px-6 py-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40 h-16">
      <div className="flex items-center gap-3">
        <ThemeToggle mode="three-way" size="md" variant="ghost" />
        <NotificationBell isMobile={false} />
      </div>
    </header>
  );
}
