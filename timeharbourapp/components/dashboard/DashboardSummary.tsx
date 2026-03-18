'use client';

import { useEffect, useState } from 'react';
import { useSocket } from '@/contexts/SocketContext';
import * as API from '@/TimeharborAPI';
import { db } from '@/TimeharborAPI/db';
import { formatDurationMs } from '@/lib/formatDuration';

interface DashboardStats {
  totalHoursToday: string;
  totalHoursWeek: string;
  totalMsToday: number;
  totalMsWeek: number;
}

const DEFAULT_STATS: DashboardStats = {
  totalHoursToday: '0h 0m',
  totalHoursWeek: '0h 0m',
  totalMsToday: 0,
  totalMsWeek: 0,
};

export default function DashboardSummary() {
  const { socket } = useSocket();
  const [stats, setStats] = useState<DashboardStats>(DEFAULT_STATS);
  const [loading, setLoading] = useState(true);

  // Fetch fresh stats from backend and update Dexie + state
  const refreshFromBackend = async () => {
    try {
      const data = await API.dashboard.getStats();
      setStats({
        ...data,
        totalMsToday: data.totalMsToday ?? 0,
        totalMsWeek: data.totalMsWeek ?? 0,
      });
    } catch (error) {
      console.error('Error refreshing dashboard stats:', error);
    }
  };

  useEffect(() => {
    const cacheKey = '__personal__';

    // 1. Read Dexie cache immediately
    db.dashboardStats.get(cacheKey).then((cached: any) => {
      if (cached?.data) {
        setStats(cached.data);
      }
      setLoading(false);

      // 2. Always fetch fresh from backend in background
      refreshFromBackend();
    }).catch(() => {
      setLoading(false);
      refreshFromBackend();
    });

    // 3. Re-fetch on clock events (clock-in / clock-out)
    const handleStatsRefresh = () => refreshFromBackend();
    window.addEventListener('dashboard-stats-refresh', handleStatsRefresh);
    return () => window.removeEventListener('dashboard-stats-refresh', handleStatsRefresh);
  }, []);

  // 4. Live update via WebSocket
  useEffect(() => {
    if (!socket) return;
    const handleStatsUpdated = (payload: {
      teamId: string | null;
      totalHoursToday: string;
      totalHoursWeek: string;
      totalMsToday?: number;
      totalMsWeek?: number;
    }) => {
      setStats(prev => ({
        ...prev,
        totalHoursToday: payload.totalHoursToday,
        totalHoursWeek: payload.totalHoursWeek,
        totalMsToday: payload.totalMsToday ?? prev.totalMsToday,
        totalMsWeek: payload.totalMsWeek ?? prev.totalMsWeek,
      }));
    };
    socket.on('stats_updated', handleStatsUpdated);
    return () => { socket.off('stats_updated', handleStatsUpdated); };
  }, [socket]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 md:gap-6 animate-pulse">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="h-32 bg-gray-100 dark:bg-gray-800 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 md:gap-6">
      <div className="p-3 md:p-6 bg-primary-50 dark:bg-primary-900/20 rounded-xl border border-primary-100 dark:border-primary-800 flex flex-col justify-between">
        <div>
          <h3 className="text-xs md:text-lg font-semibold text-primary-900 dark:text-primary-100 mb-1 md:mb-2 truncate">
            Total Hours
          </h3>
          <p className="text-lg md:text-3xl font-bold text-primary-600 dark:text-primary-400 truncate">
            {stats.totalMsToday > 0 ? formatDurationMs(stats.totalMsToday) : stats.totalHoursToday}
          </p>
        </div>
        <p className="text-[10px] md:text-sm text-primary-600/60 dark:text-primary-400/60 mt-1 truncate">Today</p>
      </div>

      <div className="p-3 md:p-6 bg-primary-50 dark:bg-primary-900/20 rounded-xl border border-primary-100 dark:border-primary-800 flex flex-col justify-between">
        <div>
          <h3 className="text-xs md:text-lg font-semibold text-primary-900 dark:text-primary-100 mb-1 md:mb-2 truncate">
            This Week
          </h3>
          <p className="text-lg md:text-3xl font-bold text-primary-600 dark:text-primary-400 truncate">
            {stats.totalMsWeek > 0 ? formatDurationMs(stats.totalMsWeek) : stats.totalHoursWeek}
          </p>
        </div>
        <p className="text-[10px] md:text-sm text-primary-600/60 dark:text-primary-400/60 mt-1 truncate">Total hours</p>
      </div>
    </div>
  );
}
