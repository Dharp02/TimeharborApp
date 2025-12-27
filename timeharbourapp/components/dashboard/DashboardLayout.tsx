'use client';

import { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import TeamSelectionModal from './TeamSelectionModal';
import { ClockInProvider } from './ClockInContext';
import DesktopFooter from './DesktopFooter';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [hasSelectedTeam, setHasSelectedTeam] = useState(false);

  // Simulate checking if user has a team selected
  // In a real app, this would check the user's state/context
  useEffect(() => {
    // For demo purposes, we'll start with false to show the modal
    // You can change this logic based on your actual data
    const checkTeamStatus = async () => {
      // const team = await getUserTeam();
      // setHasSelectedTeam(!!team);
    };
    checkTeamStatus();
  }, []);

  return (
    <ClockInProvider>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {!hasSelectedTeam && (
          <TeamSelectionModal onTeamSelected={() => setHasSelectedTeam(true)} />
        )}

        {/* Desktop Sidebar */}
        <Sidebar />

        {/* Mobile Header */}
        <div className="md:hidden fixed top-0 left-0 right-0 z-30 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 pt-12">
          <h1 className="text-xl font-bold text-blue-600 dark:text-blue-400">Timeharbor</h1>
        </div>

        {/* Main Content */}
        <main className={`
          transition-all duration-200
          md:ml-64 
          pt-16 md:pt-0 
          pb-20 md:pb-24
          min-h-screen
        `}>
          <div className="p-4 md:p-8">
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
