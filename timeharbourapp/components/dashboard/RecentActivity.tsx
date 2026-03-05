'use client';

import Link from 'next/link';
import { ChevronRight, Clock } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import type { Activity } from '@/TimeharborAPI/dashboard';
import { fetchActivitiesByDateRange } from '@/TimeharborAPI/dashboard';
import { DateTime } from 'luxon';
import { useTeam } from './TeamContext';
import { useRefresh } from '@/contexts/RefreshContext';
import { useSocket } from '@/contexts/SocketContext';

/**
 * Fetches recent activity directly from the API (same source as All Activity page).
 * Refreshes on pull-to-refresh via RefreshContext.
 */
export default function RecentActivity() {
  const { currentTeam } = useTeam();
  const { register } = useRefresh();
  const { socket } = useSocket();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!currentTeam?.id) return;
    setLoading(true);
    try {
      const from = DateTime.now().startOf('day').toISO() || '';
      const to = DateTime.now().endOf('day').toISO() || '';
      const data = await fetchActivitiesByDateRange(currentTeam.id, from, to);
      setActivities(data.slice(0, 10));
    } catch (e) {
      console.error('RecentActivity fetch failed', e);
    } finally {
      setLoading(false);
    }
  }, [currentTeam?.id]);

  useEffect(() => {
    fetchData();
    const unregister = register(fetchData);
    return unregister;
  }, [fetchData, register]);

  // Re-fetch whenever the backend signals that activity logs have changed
  // (covers clock-in/out, breaks, tickets — on this device or any other).
  useEffect(() => {
    if (!socket) return;
    socket.on('activity_logs_updated', fetchData);
    socket.on('stats_updated', fetchData);
    socket.on('session_state_restore', fetchData);
    return () => {
      socket.off('activity_logs_updated', fetchData);
      socket.off('stats_updated', fetchData);
      socket.off('session_state_restore', fetchData);
    };
  }, [socket, fetchData]);

  const formatDate = (dateString: string) =>
    DateTime.fromISO(dateString).toFormat('M/d/yyyy');

  const formatTime = (dateString: string) =>
    DateTime.fromISO(dateString).toFormat('h:mm a');

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 md:px-6 pt-4 md:pt-6 pb-4">
        <h2 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white">
          Recent Activity
        </h2>
      </div>

      {loading ? (
        <div className="px-4 md:px-6 pb-4 space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-100 dark:bg-gray-700 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : activities.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400 text-center py-8 px-4">No recent activity</p>
      ) : (
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {activities.slice(0, 10).map((activity) => (
            <div
              key={activity.id}
              className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                activity.status === 'Active' ? 'bg-green-50/50 dark:bg-green-900/5' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className={`mt-1 p-2 rounded-full ${
                    activity.status === 'Active' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'
                  }`}>
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {activity.title}
                      </h3>
                      {activity.status === 'Active' && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 rounded-full">
                          Active
                        </span>
                      )}
                    </div>
                    {activity.subtitle && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {activity.subtitle}
                      </p>
                    )}
                    {activity.description && activity.description !== activity.subtitle && (
                      <div className="mt-2 text-sm bg-gray-50 dark:bg-gray-800 p-2 rounded border border-gray-100 dark:border-gray-700 text-gray-700 dark:text-gray-300">
                        {activity.description}
                      </div>
                    )}
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      {formatDate(activity.startTime)} • {formatTime(activity.startTime)}
                      {activity.endTime ? ` - ${formatTime(activity.endTime)}` : ''}
                    </p>
                  </div>
                </div>

                {activity.duration && (
                  <div className={`shrink-0 px-3 py-1 rounded-lg text-sm font-mono font-medium whitespace-nowrap ${
                    activity.status === 'Active'
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                  }`}>
                    {activity.duration}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex justify-end">
        <Link
          href="/dashboard/activity"
          className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1"
        >
          See All <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
