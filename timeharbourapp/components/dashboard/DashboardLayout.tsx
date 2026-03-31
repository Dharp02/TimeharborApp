'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

// Isolated component — only this tiny subtree de-opts for useSearchParams.
// Wrapping it in <Suspense> lets the rest of DashboardLayout stream normally.
function MemberName() {
  const searchParams = useSearchParams();
  return <>{searchParams?.get('name') || 'Member'}</>;
}
import Header from './Header';
import BottomNav from './BottomNav';
import AppSidebar from './AppSidebar';
import { ClockInProvider } from './ClockInContext';
import DesktopFooter from './DesktopFooter';
import { ChevronLeft } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import ProfileAvatarMenu from './ProfileAvatarMenu';
import NotificationBell from './NotificationBell';
import PullToRefresh from '@/components/ui/PullToRefresh';
import { Button, SidebarProvider, SidebarMobileToggle } from '@mieweb/ui';
import SyncInitializer from '@/components/SyncInitializer';
import { BrandWatcher } from './BrandSwitcher';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Notepad editor override — lets the notepad page signal the header
  const [notepadOverride, setNotepadOverride] = useState<{ title: string } | null>(null);

  const handleNotepadEditor = useCallback((e: Event) => {
    const detail = (e as CustomEvent).detail;
    setNotepadOverride(detail ? { title: detail.title || 'Untitled' } : null);
  }, []);

  useEffect(() => {
    window.addEventListener('notepad-header', handleNotepadEditor);
    return () => window.removeEventListener('notepad-header', handleNotepadEditor);
  }, [handleNotepadEditor]);

  // Reset override when navigating away from notepad
  useEffect(() => {
    if (!pathname?.startsWith('/dashboard/notepad')) {
      setNotepadOverride(null);
    }
  }, [pathname]);

  const getHeaderTitle = () => {
    if (!pathname) return 'Time Tracker';

    if (pathname === '/dashboard/tickets/create') return 'New Ticket';
    if (pathname === '/dashboard/tickets/edit' || pathname.match(/\/dashboard\/tickets\/[^/]+\/edit/)) return 'Edit Ticket';
    if (pathname.startsWith('/dashboard/tickets')) return 'Tickets';
    if (pathname.startsWith('/dashboard/calendar')) return 'Calendar';
    if (pathname.startsWith('/dashboard/projects')) return 'Projects';
    if (pathname.startsWith('/dashboard/notepad')) {
      return notepadOverride ? notepadOverride.title : 'Notepad';
    }
    if (pathname.startsWith('/dashboard/activity')) return 'All Activity';
    if (pathname.startsWith('/dashboard/notifications')) return 'Notifications';
    
    // Settings Routes
    if (pathname === '/dashboard/settings' || pathname === '/dashboard/settings/') return 'Settings';
    if (pathname.startsWith('/dashboard/settings/timesheet')) return 'My Timesheet';
    if (pathname.startsWith('/dashboard/settings/profile')) return user?.full_name || 'My Profile';
    if (pathname.startsWith('/dashboard/settings/teams')) return 'Team Settings';
    if (pathname.startsWith('/dashboard/settings')) return 'Settings';
    
    if (pathname.startsWith('/dashboard/member')) {
      return null; // rendered via <MemberName> Suspense component below
    }
    return 'Time Tracker';
  };

  const shouldShowBackButton = () => {
    if (!pathname) return false;
    
    // Normalize path by removing trailing slash and forcing lowercase
    let normalizedPath = pathname.toLowerCase();
    if (normalizedPath.endsWith('/')) {
      normalizedPath = normalizedPath.slice(0, -1);
    }
    
    // Explicitly hide back button on main tab pages
    const mainTabs = ['/dashboard', '/dashboard/tickets', '/dashboard/settings', '/dashboard/notifications'];
    if (mainTabs.includes(normalizedPath)) return false;

    if (pathname.startsWith('/dashboard/notepad') && notepadOverride) return true;

    return pathname.startsWith('/dashboard/member') || pathname.startsWith('/dashboard/settings') || pathname.startsWith('/dashboard/notifications') || pathname.startsWith('/dashboard/activity') || pathname.startsWith('/dashboard/tickets/');
  };

  const handleBackClick = () => {
    if (pathname?.startsWith('/dashboard/notepad') && notepadOverride) {
      window.dispatchEvent(new CustomEvent('notepad-back'));
      return;
    }
    if (pathname?.startsWith('/dashboard/notifications')) {
      router.push('/dashboard');
    } else {
      router.back();
    }
  };

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  // Handle pending navigation from push notifications
  useEffect(() => {
    const pendingNav = localStorage.getItem('pendingNavigation');
    if (pendingNav) {
      console.log('🔔 [DASHBOARD] Found pending navigation:', pendingNav);
      localStorage.removeItem('pendingNavigation');
      
      // Small delay to ensure app is ready
      setTimeout(() => {
        console.log('🚀 [DASHBOARD] Navigating to:', pendingNav);
        router.push(pendingNav);
      }, 500);
    }
  }, [router]);

  return (
    <ClockInProvider>
      <SidebarProvider>
        <SyncInitializer />
        <BrandWatcher />
        <div className="min-h-screen bg-background lg:flex">
          {/* Sidebar (desktop: always visible, mobile: slide-in overlay) */}
          <AppSidebar />

          {/* Content area — takes remaining width on desktop */}
          <div className="flex-1 min-w-0">
            {/* Desktop Header */}
            <Header />

            {/* Mobile Header */}
            <div className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-card border-b border-border px-4 py-3 pt-16 flex justify-between items-center">
              <div className="flex items-center">
                {shouldShowBackButton() ? (
                  <Button
                    variant="ghost"
                    onClick={handleBackClick}
                    className="p-1 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                    aria-label="Go back"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </Button>
                ) : (
                  <SidebarMobileToggle className="p-1 text-muted-foreground" />
                )}
                <h1 className="text-xl font-bold text-primary-600 dark:text-primary-400 truncate max-w-[200px]">
                  {pathname?.startsWith('/dashboard/member')
                    ? <Suspense fallback="Member"><MemberName /></Suspense>
                    : getHeaderTitle()}
                </h1>
              </div>
              <div className="flex items-center gap-1">
                <NotificationBell isMobile />
                <ProfileAvatarMenu />
              </div>
            </div>

            {/* Main Content */}
            <main className={`
              transition-all duration-200
              pt-25.5 lg:pt-4
              pb-20 lg:pb-24
              min-h-screen
              overflow-x-hidden
            `}>
              <PullToRefresh>
                <div className="px-4 py-4 lg:px-6 lg:py-4">
                  {children}
                </div>
              </PullToRefresh>
            </main>

            {/* Desktop Footer */}
            <DesktopFooter />

            {/* Mobile Bottom Nav */}
            <BottomNav />
          </div>
        </div>
      </SidebarProvider>
    </ClockInProvider>
  );
}
