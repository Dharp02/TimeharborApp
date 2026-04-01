'use client';

import { usePathname, useRouter } from 'next/navigation';
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarNav,
  SidebarNavGroup,
  SidebarNavItem,
  SidebarFooter,
  SidebarToggle,
  useSidebar,
} from '@mieweb/ui';
import { resolveBackendAsset } from '@/TimeharborAPI/apiUrl';
import {
  Clock,
  CalendarDays,
  Ticket,
  FolderOpen,
  BarChart3,
  Sheet,
  Activity,
  NotebookPen,
  Settings,
  HelpCircle,
  LogOut,
  Trash2,
  UserPen,
  ScrollText,
  MessageSquarePlus,
  Bug,
} from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { auth } from '@/TimeharborAPI';
import { clearDatabase } from '@/TimeharborAPI/db';

const NAV_SECTIONS = [
  {
    label: 'Main',
    items: [
      { label: 'Time Tracker', icon: Clock, href: '/dashboard' },
      { label: 'Calendar', icon: CalendarDays, href: '/dashboard/calendar' },
      { label: 'Tickets', icon: Ticket, href: '/dashboard/tickets' },
      { label: 'Projects', icon: FolderOpen, href: '/dashboard/projects' },
      { label: 'Notepad', icon: NotebookPen, href: '/dashboard/notepad' },
    ],
  },
  {
    label: 'Analytics',
    items: [
      { label: 'Reports', icon: BarChart3, href: '/dashboard/reports' },
      { label: 'Timesheet', icon: Sheet, href: '/dashboard/settings/timesheet' },
    ],
  },
  {
    label: 'Social',
    items: [
      { label: 'Pulse', icon: Activity, href: '/dashboard/pulse' },
    ],
  },
  {
    label: 'General',
    items: [
      { label: 'Settings', icon: Settings, href: '/dashboard/settings' },
      { label: 'Op Logs', icon: ScrollText, href: '/dashboard/oplogs' },
      { label: 'Help & Support', icon: HelpCircle, href: '/dashboard/help' },
      { label: 'Send Feedback', icon: MessageSquarePlus, href: 'https://github.com/Dharp02/TimeharborApp/discussions/49', external: true },
      { label: 'Report an Issue', icon: Bug, href: 'https://github.com/Dharp02/TimeharborApp/issues/new', external: true },
    ],
  },
];

export default function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const { closeMobile, isCollapsed } = useSidebar();

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname?.startsWith(href) ?? false;
  };

  const getInitials = () => {
    if (!user?.full_name) return user?.email?.charAt(0).toUpperCase() || 'U';
    const parts = user.full_name.split(' ');
    if (parts.length >= 2) {
      return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }
    return user.full_name.substring(0, 2).toUpperCase();
  };

  const handleNavClick = (href: string) => {
    router.push(href);
    closeMobile();
  };

  const handleClearCache = async () => {
    if (!window.confirm('Clear all local data? This won\'t log you out, but will remove offline data until it syncs again.')) return;
    try {
      await clearDatabase();

      const preserved: Record<string, string> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('auth') || key.includes('supabase') || key.includes('token'))) {
          preserved[key] = localStorage.getItem(key) || '';
        }
      }
      localStorage.clear();
      Object.entries(preserved).forEach(([k, v]) => localStorage.setItem(k, v));
      sessionStorage.clear();
      alert('Cache cleared successfully!');
      window.location.reload();
    } catch {
      alert('Failed to clear cache. Please try again.');
    }
  };

  return (
    <Sidebar className="lg:sticky lg:top-0 z-50 pt-12 lg:pt-0">
      <SidebarToggle position="floating" />
      <SidebarHeader>
        <div className="flex items-center gap-3 px-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-600 text-white font-bold text-sm">
            T
          </div>
          {!isCollapsed && (
            <span className="text-lg font-bold">
              <span className="text-primary-600 dark:text-primary-400">Time</span>
              <span className="text-primary-400 dark:text-primary-300">Harbor</span>
            </span>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* User Info */}
        <div
          className={isCollapsed ? 'px-2 py-3 mb-2 flex justify-center' : 'px-4 py-3 mb-2 cursor-pointer hover:bg-muted rounded-lg transition-colors'}
          onClick={() => handleNavClick('/dashboard/settings/profile')}
          role="button"
          aria-label="Edit profile"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-500 text-white font-semibold text-sm overflow-hidden">
              {user?.image ? (
                <img src={resolveBackendAsset(user.image)} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                getInitials()
              )}
            </div>
            {!isCollapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground truncate">
                  {user?.full_name || 'User'}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  Personal workspace
                </p>
              </div>
            )}
            {!isCollapsed && (
              <UserPen className="w-4 h-4 text-muted-foreground shrink-0" />
            )}
          </div>
        </div>

        {/* Navigation */}
        <SidebarNav>
          {NAV_SECTIONS.map((section) => (
            <SidebarNavGroup key={section.label} label={section.label} defaultExpanded>
              {section.items.map((item) => (
                <SidebarNavItem
                  key={item.href}
                  label={item.label}
                  icon={<item.icon className="w-5 h-5" />}
                  isActive={'external' in item ? false : isActive(item.href)}
                  onClick={() => {
                    if ('external' in item) {
                      window.open(item.href, '_blank', 'noopener,noreferrer');
                    } else {
                      handleNavClick(item.href);
                    }
                  }}
                />
              ))}
            </SidebarNavGroup>
          ))}
        </SidebarNav>
      </SidebarContent>

      <SidebarFooter>
        <SidebarNavItem
          label="Clear Cache"
          icon={<Trash2 className="w-5 h-5" />}
          onClick={handleClearCache}
        />
        <SidebarNavItem
          label="Sign Out"
          icon={<LogOut className="w-5 h-5" />}
          onClick={() => auth.signOut()}
          className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
        />
        {!isCollapsed && (
          <div className="flex items-center justify-center px-2 mt-2">
            <span className="text-xs text-muted-foreground">
              TimeHarbor v{process.env.NEXT_PUBLIC_APP_VERSION}
            </span>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
