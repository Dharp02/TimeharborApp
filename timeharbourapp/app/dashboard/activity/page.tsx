'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@mieweb/ui';
import { Clock, Loader2 } from 'lucide-react';
import { DateTime } from 'luxon';
import { DateRangePickerWithPresets } from '@/components/DateRangePickerWithPresets';
import { dateFilterPresets, resolveRange, type LuxonDateRange } from '@/lib/datePresets';
import { Activity, fetchActivitiesByDateRange } from '@/TimeharborAPI/dashboard';
import { useRefresh } from '../../../contexts/RefreshContext';
import { useTeam } from '@/components/dashboard/TeamContext';
import { useSocket } from '@/contexts/SocketContext';

export default function ActivityPage() {
  const { currentTeam } = useTeam();
  const { socket } = useSocket();
  const { register } = useRefresh();
  const [visibleCount, setVisibleCount] = useState(20);
  const [dateRange, setDateRange] = useState<LuxonDateRange>({
    from: DateTime.now().startOf('day'),
    to: DateTime.now().endOf('day'),
  });
  const [preset, setPreset] = useState<string>('today');
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Always fetch from work_logs (the source of truth) for all date presets, including today.
  const fetchData = useCallback(async (from: DateTime, to: DateTime) => {
    if (!currentTeam?.id) return;
    setIsLoading(true);
    try {
      const data = await fetchActivitiesByDateRange(
        currentTeam.id,
        from.toISO() || '',
        to.toISO() || '',
      );
      setActivities(data);
    } catch (error) {
      console.error('Failed to fetch activities:', error);
    } finally {
      setIsLoading(false);
    }
  }, [currentTeam?.id]);

  // Fetch on mount, date range change, or refresh
  useEffect(() => {
    fetchData(dateRange.from!, dateRange.to!);

    const unregister = register(async () => {
      await fetchData(dateRange.from!, dateRange.to!);
    });
    return unregister;
  }, [fetchData, dateRange, register]);

  // Re-fetch on socket stats_updated for live updates (only for "today" view)
  useEffect(() => {
    if (!socket || preset !== 'today') return;
    const handler = () => fetchData(dateRange.from!, dateRange.to!);
    socket.on('stats_updated', handler);
    return () => { socket.off('stats_updated', handler); };
  }, [socket, preset, fetchData, dateRange]);

  const handleRangeChange = (range: { start: Date | null; end: Date | null }, presetKey?: string) => {
    setDateRange(resolveRange(range, presetKey));
    setPreset(presetKey || '');
    setVisibleCount(20);
  };

  const formatDate = (dateString: string) => DateTime.fromISO(dateString).toFormat('M/d/yyyy');
  const formatTime = (dateString: string) => DateTime.fromISO(dateString).toFormat('h:mm a');

  const displayActivities = activities.slice(0, visibleCount);
  const hasMore = activities.length > visibleCount;

  return (
    <div className="max-w-4xl mx-auto px-0 py-2 md:p-6 space-y-4">
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm">
        <div className="flex-1 w-full md:w-auto">
          <DateRangePickerWithPresets
            value={{ start: dateRange.from.toJSDate(), end: dateRange.to.toJSDate() }}
            onChange={handleRangeChange}
            activePreset={preset}
            presets={dateFilterPresets}
            variant="responsive"
            className="w-full md:w-auto"
          />
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Showing {displayActivities.length} of {activities.length} events
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-gray-500 dark:text-gray-400 flex flex-col items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary-500 mb-4" />
            <p>Loading activities...</p>
          </div>
        ) : activities.length === 0 ? (
          <div className="p-12 text-center text-gray-500 dark:text-gray-400">
            <Clock className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
            <p className="text-lg font-medium">No activity recorded yet</p>
            <p className="text-sm mt-1">Clock in or start working on tickets to see activity here.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {displayActivities.map((activity) => (
              <div
                key={activity.id}
                className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                  activity.status === 'Active' ? 'bg-green-50/50 dark:bg-green-900/5' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className={`mt-1 p-2 rounded-full ${
                      activity.status === 'Active' ? 'bg-green-100 text-green-600' : 'bg-primary-100 text-primary-600'
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

        {hasMore && (
          <div className="p-4 border-t border-gray-100 dark:border-gray-700 text-center">
            <Button
              variant="ghost"
              onClick={() => setVisibleCount(prev => prev + 20)}
              className="px-4 py-2 text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
            >
              Load More
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
