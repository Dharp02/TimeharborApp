'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
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
  Trash2,
  UserPen,
  ScrollText,
  MessageSquarePlus,
  Bug,
  Share2,
} from 'lucide-react';
import { useAppSession } from '@/components/AppSessionProvider';
import { clearDatabase } from '@/TimeharborAPI/db';
import { getProfile } from '@/TimeharborAPI/profile';
import ShareMyLinkModal from '@/components/ShareMyLinkModal';
import { useToast } from '@mieweb/ui';

const NAV_SECTIONS = [
  {
    label: 'Main',
    items: [
      { label: 'Time Tracker', icon: Clock, href: '/dashboard', walkthrough: 'nav-time-tracker' },
      { label: 'Calendar', icon: CalendarDays, href: '/dashboard/calendar', walkthrough: 'nav-calendar' },
      { label: 'Tickets', icon: Ticket, href: '/dashboard/tickets', walkthrough: 'nav-tickets' },
      { label: 'Projects', icon: FolderOpen, href: '/dashboard/projects', walkthrough: 'nav-projects' },
      { label: 'Notepad', icon: NotebookPen, href: '/dashboard/notepad', walkthrough: 'nav-notepad' },
    ],
  },
  {
    label: 'Analytics',
    items: [
      { label: 'Reports', icon: BarChart3, href: '/dashboard/reports', comingSoon: true },
      { label: 'Timesheet', icon: Sheet, href: '/dashboard/settings/timesheet', walkthrough: 'nav-timesheet' },
    ],
  },
  {
    label: 'Social',
    items: [
      { label: 'Pulse', icon: Activity, href: '/dashboard/pulse', comingSoon: true },
      { label: 'Share My Link', icon: Share2, href: '#share', action: 'share' },
    ],
  },
  {
    label: 'General',
    items: [
      { label: 'Settings', icon: Settings, href: '/dashboard/settings', walkthrough: 'nav-settings' },
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
  const { user } = useAppSession();
  const { closeMobile, isCollapsed } = useSidebar();
  const toast = useToast();
  const [showShareModal, setShowShareModal] = useState(false);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);

  // Load profile from Dexie on mount
  useEffect(() => {
    getProfile().then((p) => {
      if (p?.displayName) setProfileName(p.displayName);
      if (p?.avatarBase64) setProfileAvatar(p.avatarBase64);
    }).catch(() => {});
  }, []);

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname?.startsWith(href) ?? false;
  };

  const getInitials = () => {
    const name = (profileName || user?.full_name || '').trim();
    if (!name) return 'U';
    const parts = name.split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const handleNavClick = (href: string) => {
    router.push(href);
    closeMobile();
  };

  return (
    <>
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
          data-walkthrough="sidebar-profile"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-500 text-white font-semibold text-sm overflow-hidden">
              {profileAvatar ? (
                <img src={profileAvatar} alt="Profile" className="w-full h-full object-cover" />
              ) : user?.image ? (
                <img src={resolveBackendAsset(user.image)} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                getInitials()
              )}
            </div>
            {!isCollapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground truncate">
                  {profileName || user?.full_name || 'User'}
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
              {section.items.map((item) => {
                const navItem = (
                  <SidebarNavItem
                    key={'action' in item ? item.label : item.href}
                    label={item.label}
                    icon={<item.icon className="w-5 h-5" />}
                    isActive={'external' in item || 'action' in item ? false : isActive(item.href)}
                    onClick={() => {
                      if ('comingSoon' in item && item.comingSoon) {
                        toast.info(`${item.label} — Coming Soon!`);
                      } else if ('action' in item && item.action === 'share') {
                        closeMobile();
                        setShowShareModal(true);
                      } else if ('external' in item) {
                        window.open(item.href, '_blank', 'noopener,noreferrer');
                      } else {
                        handleNavClick(item.href);
                      }
                    }}
                  />
                );
                return 'walkthrough' in item && item.walkthrough ? (
                  <div key={item.href} data-walkthrough={item.walkthrough}>
                    {navItem}
                  </div>
                ) : navItem;
              })}
            </SidebarNavGroup>
          ))}
        </SidebarNav>
      </SidebarContent>

      <SidebarFooter>
        {!isCollapsed && (
          <div className="flex items-center justify-center px-2 mt-2">
            <span className="text-xs text-muted-foreground">
              TimeHarbor v{process.env.NEXT_PUBLIC_APP_VERSION}{process.env.NEXT_PUBLIC_APP_BUILD ? ` build ${process.env.NEXT_PUBLIC_APP_BUILD}` : ''}
            </span>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
    <ShareMyLinkModal isOpen={showShareModal} onClose={() => setShowShareModal(false)} />
    </>
  );
}

