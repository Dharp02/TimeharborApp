'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Header from './Header';
import BottomNav from './BottomNav';
import TeamSelectionModal from './TeamSelectionModal';
import { ClockInProvider } from './ClockInContext';
import DesktopFooter from './DesktopFooter';
import { ChevronLeft, Users, Plus } from 'lucide-react';
import { useTeam } from './TeamContext';
import { useAuth } from '@/components/auth/AuthProvider';
import ProfileAvatarMenu from './ProfileAvatarMenu';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { currentTeam, isLoading } = useTeam();
  const { user } = useAuth();
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const getHeaderTitle = () => {
    if (!pathname) return 'Timeharbor';
    if (pathname.startsWith('/dashboard/teams')) return 'Teams';
    if (pathname.startsWith('/dashboard/tickets')) return 'Tickets';
    if (pathname.startsWith('/dashboard/notifications')) return 'Notifications';
    
    // Settings Routes
    if (pathname === '/dashboard/settings' || pathname === '/dashboard/settings/') return 'Settings';
    if (pathname.startsWith('/dashboard/settings/profile')) return user?.full_name || 'My Profile';
    if (pathname.startsWith('/dashboard/settings')) return 'Settings';
    
    if (pathname.startsWith('/dashboard/member')) {
      const memberName = searchParams?.get('name');
      return memberName || 'Member';
    }
    return 'Timeharbor';
  };

  const shouldShowBackButton = () => {
    if (!pathname) return false;
    
    // Normalize path by removing trailing slash and forcing lowercase
    let normalizedPath = pathname.toLowerCase();
    if (normalizedPath.endsWith('/')) {
      normalizedPath = normalizedPath.slice(0, -1);
    }
    
    // Explicitly hide back button on main tab pages
    const mainTabs = ['/dashboard', '/dashboard/teams', '/dashboard/tickets', '/dashboard/settings', '/dashboard/notifications'];
    if (mainTabs.includes(normalizedPath)) return false;

    return pathname.startsWith('/dashboard/member') || pathname.startsWith('/dashboard/settings') || pathname.startsWith('/dashboard/notifications');
  };

  const handleBackClick = () => {
    if (pathname?.startsWith('/dashboard/notifications')) {
      router.push('/dashboard');
    } else {
      router.back();
    }
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
                onClick={handleBackClick}
                className="p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                aria-label="Go back"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <h1 className="text-xl font-bold text-blue-600 dark:text-blue-400 truncate max-w-[200px]">{getHeaderTitle()}</h1>
            {pathname?.startsWith('/dashboard/teams') && (
              <div className="flex items-center gap-1 ml-2">
                <button
                  onClick={() => {
                    const event = new CustomEvent('openJoinTeamModal');
                    window.dispatchEvent(event);
                  }}
                  className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                  title="Join a Team"
                >
                  <Users className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    const event = new CustomEvent('openCreateTeamModal');
                    window.dispatchEvent(event);
                  }}
                  className="p-1.5 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
                  title="Create a Team"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {currentTeam && (
              <div className="text-right mr-1">
                <div className="text-xs text-gray-500 dark:text-gray-400 leading-none">Team</div>
                <div className="text-sm font-semibold text-gray-900 dark:text-white leading-tight truncate max-w-[120px]">{currentTeam.name}</div>
              </div>
            )}
            <ProfileAvatarMenu onTeamSwitchClick={() => setIsTeamModalOpen(true)} />
          </div>
        </div>

        {/* Main Content */}
        <main className={`
          transition-all duration-200
          pt-28 md:pt-24
          pb-20 md:pb-24
          min-h-screen
          overflow-x-hidden
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
