'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Header from './Header';
import BottomNav from './BottomNav';
import TeamSelectionModal from './TeamSelectionModal';
import { ClockInProvider } from './ClockInContext';
import DesktopFooter from './DesktopFooter';
import { Users, ArrowRightLeft, ChevronLeft } from 'lucide-react';
import { useTeam } from './TeamContext';
import { useAuth } from '@/components/auth/AuthProvider';
import NotificationBell from './NotificationBell';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { currentTeam, isLoading } = useTeam();
  const { user } = useAuth();
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const getHeaderTitle = () => {
    if (!pathname) return 'Timeharbor';
    if (pathname.startsWith('/dashboard/teams')) return 'Teams';
    if (pathname.startsWith('/dashboard/tickets')) return 'Tickets';
    if (pathname.startsWith('/dashboard/settings')) return user?.full_name || user?.email || 'Menu';
    if (pathname.startsWith('/dashboard/member')) {
      const memberName = searchParams?.get('name');
      return memberName || 'Member';
    }
    return 'Timeharbor';
  };

  const shouldShowBackButton = () => {
    if (!pathname) return false;
    return pathname.startsWith('/dashboard/member') || pathname.startsWith('/dashboard/settings');
  };


  useEffect(() => {
    if (!isLoading && !currentTeam) {
      setIsTeamModalOpen(true);
    }
  }, [currentTeam, isLoading]);

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
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <TeamSelectionModal 
          isOpen={isTeamModalOpen}
          onClose={() => setIsTeamModalOpen(false)}
        />

        {/* Desktop Header */}
        <Header 
          onTeamSwitch={() => setIsTeamModalOpen(true)} 
          currentTeamName={currentTeam?.name || null}
        />

        {/* Mobile Header */}
        <div className="md:hidden fixed top-0 left-0 right-0 z-30 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 pt-16 flex justify-between items-center">
          <div className="flex items-center gap-2">
            {shouldShowBackButton() && (
              <button
                onClick={() => router.back()}
                className="p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                aria-label="Go back"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <h1 className="text-xl font-bold text-blue-600 dark:text-blue-400 truncate max-w-[200px]">{getHeaderTitle()}</h1>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell isMobile={true} />
            <button 
                onClick={() => setIsTeamModalOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors border border-gray-200 dark:border-gray-700"
              >
                <ArrowRightLeft className="w-4 h-4" />
                <span className="text-sm font-medium">{currentTeam?.name || 'Switch Team'}</span>
            </button>
          </div>
        </div>

        {/* Main Content */}
        <main className={`
          transition-all duration-200
          pt-28 md:pt-24
          pb-20 md:pb-24
          min-h-screen
        `}>
          <div className="p-4 md:p-8 max-w-7xl mx-auto">
            {children}
          </div>
        </main>

        {/* Desktop Footer */}
        <DesktopFooter />

        {/* Mobile Bottom Nav */}
        <BottomNav />
      </div>
    </ClockInProvider>
  );
}
