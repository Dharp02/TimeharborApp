'use client';

import { useEffect, useState } from 'react';
import { useTeam } from './TeamContext';
import * as API from '@/TimeharborAPI';
import Link from 'next/link';

interface DashboardStats {
  totalHoursToday: string;
  totalHoursWeek: string;
  teamMembers: number;
}

export default function DashboardSummary() {
  const { currentTeam } = useTeam();
  const [stats, setStats] = useState<DashboardStats>({
    totalHoursToday: '0h 0m',
    totalHoursWeek: '0h 0m',
    teamMembers: 0
  });
  const [loading, setLoading] = useState(true);

  // Calculate real-time online members from local state
  // We subtract 1 if we don't want to count ourselves, or keep it as is depending on requirement.
  // Usually "Team Members Online" includes everyone online in the team.
  const onlineCount = currentTeam?.members?.filter(m => m.status === 'online').length || 0;

  const fetchStats = async () => {
    try {
      if (!currentTeam?.id) return;
      // Don't set full loading spinner for refresh, only initial
      // setLoading(true); 
      const data = await API.dashboard.getStats(currentTeam?.id);
      setStats(data);
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentTeam?.id) {
      fetchStats();
    }
    
    // Listen for clock-out events to auto-refresh
    const handleStatsRefresh = () => {
        console.log('🔄 DashboardStats: Refreshing due to clock event');
        fetchStats();
    };

    window.addEventListener('dashboard-stats-refresh', handleStatsRefresh as EventListener);
    
    return () => {
        window.removeEventListener('dashboard-stats-refresh', handleStatsRefresh as EventListener);
    }
  }, [currentTeam?.id]);

  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-3 md:gap-6 animate-pulse">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-32 bg-gray-100 dark:bg-gray-800 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-3 md:gap-6">
      <div className="p-3 md:p-6 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800 flex flex-col justify-between">
        <div>
          <h3 className="text-xs md:text-lg font-semibold text-blue-900 dark:text-blue-100 mb-1 md:mb-2 truncate">
            Total Hours
          </h3>
          <p className="text-lg md:text-3xl font-bold text-blue-600 dark:text-blue-400 truncate">{stats.totalHoursToday}</p>
        </div>
        <p className="text-[10px] md:text-sm text-blue-600/60 dark:text-blue-400/60 mt-1 truncate">Today</p>
      </div>

      <div className="p-3 md:p-6 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800 flex flex-col justify-between">
        <div>
          <h3 className="text-xs md:text-lg font-semibold text-indigo-900 dark:text-indigo-100 mb-1 md:mb-2 truncate">
            This Week
          </h3>
          <p className="text-lg md:text-3xl font-bold text-indigo-600 dark:text-indigo-400 truncate">{stats.totalHoursWeek}</p>
        </div>
        <p className="text-[10px] md:text-sm text-indigo-600/60 dark:text-indigo-400/60 mt-1 truncate">Total hours</p>
      </div>

      <Link href="/dashboard/teams" className="block">
        <div className="p-3 md:p-6 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-100 dark:border-green-800 flex flex-col justify-between cursor-pointer hover:shadow-lg transition-shadow">
          <div>
            <h3 className="text-xs md:text-lg font-semibold text-green-900 dark:text-green-100 mb-1 md:mb-2">
              Team Members
            </h3>
            <p className="text-lg md:text-3xl font-bold text-green-600 dark:text-green-400 truncate">{onlineCount}</p>
          </div>
          <p className="text-[10px] md:text-sm text-green-600/60 dark:text-green-400/60 mt-1 truncate">Online now</p>
        </div>
      </Link>
    </div>
  );
}
