'use client';

import { useAuth } from '@/components/auth/AuthProvider';
import {
  User,
  Lock,
  Bell,
  Globe,
  CalendarDays,
  Users,
  ChevronRight,
  Sun,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import { Text, SmallMuted, Switch, useThemeContext } from '@mieweb/ui';

export default function SettingsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useThemeContext();

  const isDark = resolvedTheme === 'dark';
  const handleThemeToggle = (checked: boolean) => setTheme(checked ? 'dark' : 'light');

  const getInitials = () => {
    if (!user?.full_name) return user?.email?.charAt(0).toUpperCase() || 'U';
    const parts = user.full_name.split(' ');
    if (parts.length >= 2) {
      return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }
    return user.full_name.substring(0, 2).toUpperCase();
  };

  const [pushEnabled, setPushEnabled] = useState(false);

  const menuItems = [
    { label: 'Edit Profile', icon: User, href: '/dashboard/settings/profile' },
    { label: 'Change Password', icon: Lock, href: '/dashboard/settings/password' },
    { label: 'Language', icon: Globe, href: '/dashboard/settings/language' },
    { label: 'Timesheet Settings', icon: CalendarDays, href: '/dashboard/settings/timesheet' },
  ];

  return (
    <div className="space-y-6 pb-8">
      {/* Profile Header */}
      <div className="flex flex-col items-center pt-6 pb-2">
        <div className="w-24 h-24 rounded-full bg-primary-400 flex items-center justify-center text-white text-3xl font-semibold mb-4 overflow-hidden">
          {user?.image ? (
            <img src={user.image} alt="Profile" className="w-full h-full object-cover" />
          ) : (
            getInitials()
          )}
        </div>
        <Text className="text-xl font-bold">{user?.full_name || 'User'}</Text>
        <SmallMuted>{user?.email}</SmallMuted>
      </div>

      {/* Menu Items */}
      <div className="divide-y divide-border -mx-4">
        {menuItems.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="flex items-center justify-between px-6 py-4 hover:bg-muted transition-colors"
          >
            <div className="flex items-center gap-4">
              <item.icon className="w-5 h-5 text-muted-foreground" />
              <Text className="font-medium">{item.label}</Text>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </Link>
        ))}

        {/* Push Notifications Toggle */}
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Bell className="w-5 h-5 text-muted-foreground" />
            <Text className="font-medium">Notification Preferences</Text>
          </div>
          <Switch
            checked={pushEnabled}
            onCheckedChange={setPushEnabled}
            aria-label="Toggle push notifications"
          />
        </div>

        {/* Display Mode */}
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Sun className="w-5 h-5 text-muted-foreground" />
            <Text className="font-medium">Display Mode</Text>
          </div>
          <Switch
            checked={isDark}
            onCheckedChange={handleThemeToggle}
            aria-label="Toggle dark mode"
          />
        </div>

        {/* Open Timehuddle */}
        <button
          onClick={() => window.open('https://timehuddle.com', '_blank')}
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-muted transition-colors"
        >
          <div className="flex items-center gap-4">
            <Users className="w-5 h-5 text-amber-500" />
            <Text className="font-medium text-amber-600 dark:text-amber-400">Open Timehuddle</Text>
          </div>
          <ChevronRight className="w-5 h-5 text-amber-500" />
        </button>
      </div>
    </div>
  );
}
