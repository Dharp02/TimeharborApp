'use client';

import { useState, useMemo, useEffect } from 'react';
import { useActivityLog } from '@/components/dashboard/ActivityLogContext';
import { useTeam } from '@/components/dashboard/TeamContext';
import { DateRangePicker, DateRange, DateRangePreset } from '@/components/DateRangePicker';
import { DateTime } from 'luxon';
import { Activity, getTimesheetTotals, TimesheetDayTotal } from '@/TimeharborAPI/dashboard';
import { formatDurationMs } from '@/lib/formatDuration';
import { Clock, Calendar, CheckCircle2, PauseCircle, PlayCircle, StopCircle } from 'lucide-react';
import { useRefresh } from '../../../../contexts/RefreshContext';

export default function TimesheetPage() {
  const { activities: cachedActivities, fetchActivitiesByDateRange } = useActivityLog();
  const { currentTeam } = useTeam();
  const { register, lastRefreshed } = useRefresh();
  const [dateRange, setDateRange] = useState<DateRange>({ 
    from: DateTime.now().startOf('day'),
    to: DateTime.now().endOf('day') 
  });
  const [preset, setPreset] = useState<DateRangePreset>('today');
  const [fetchedActivities, setFetchedActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  /** Per-day totalMs from backend (UserDailyStat), break-excluded */
  const [timesheetTotals, setTimesheetTotals] = useState<TimesheetDayTotal[]>([]);

  // Fetch per-day totalMs from backend whenever the date range changes.
  // Backend uses UserDailyStat (break-excluded) and injects live session time for today.
  useEffect(() => {
    if (!dateRange.from || !dateRange.to) return;
    const from = dateRange.from.toISODate();
    const to = dateRange.to.toISODate();
    if (!from || !to) return;
    getTimesheetTotals(from, to, currentTeam?.id)
      .then(setTimesheetTotals)
      .catch(e => console.error('Failed to fetch timesheet totals:', e));
  }, [dateRange, currentTeam?.id, lastRefreshed]);

  // Ensure fetched data updates when dependencies change
  useEffect(() => {
    const fetchFilteredData = async () => {
      // If we are looking at "today", we don't necessarily fetch, but context sync might update cachedActivities.
      // However, if we pull-to-refresh, we might want to re-run this logic?
      // Actually, if cachedActivities updates, this effect runs anyway. 
      // But if we are looking at PAST dates, we need to re-fetch if trigger happens.
      
      if (preset === 'today') {
        // No need to fetch, relying on cached context data
        return;
      }

      if (!dateRange.from || !dateRange.to) return;

      setIsLoading(true);
      try {
        const fromDate = dateRange.from || DateTime.now().startOf('day');
        const toDate = dateRange.to || DateTime.now().endOf('day');
        
        const data = await fetchActivitiesByDateRange(
          fromDate.toISO() || '',
          toDate.toISO() || ''
        );
        setFetchedActivities(data);
      } catch (error) {
        console.error('Failed to fetch activities:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFilteredData();

    // Register refresh
    const unregister = register(async () => {
        await fetchFilteredData();
    });
    
    return unregister;
  }, [dateRange, preset, cachedActivities, fetchActivitiesByDateRange, register, lastRefreshed]);

  const handleRangeChange = (range: DateRange, newPreset: DateRangePreset) => {
    setDateRange(range);
    setPreset(newPreset);
  };

  // Group activities by day
  const groupedActivities = useMemo(() => {
    const activitiesToDisplay = preset === 'today' ? cachedActivities : fetchedActivities;

    // Sort by time descending for display
    const sorted = [...activitiesToDisplay].sort((a, b) => {
      const timeA = DateTime.fromISO(a.startTime).toMillis();
      const timeB = DateTime.fromISO(b.startTime).toMillis();
      return timeB - timeA;
    });

    const groups: { [key: string]: { date: DateTime, activities: Activity[], totalDuration: number } } = {};

    // Build a lookup: date string "YYYY-MM-DD" -> totalMs from backend
    const backendTotalsMap = new Map<string, number>(timesheetTotals.map(t => [t.date, t.totalMs]));

    sorted.forEach(activity => {
      if (!activity.startTime) return;
      const date = DateTime.fromISO(activity.startTime).startOf('day');
      const dateKey = date.toISODate();
      if (!dateKey) return;

      if (!groups[dateKey]) {
        groups[dateKey] = {
          date,
          activities: [],
          totalDuration: backendTotalsMap.get(dateKey) ?? 0, // ms from backend
        };
      }
      groups[dateKey].activities.push(activity);
    });

    // Convert to array and handle empty days if needed, but for now just fetched days
    // To show all days of the week (Sunday-Saturday), we need to fill in the gaps
    const filledGroups: { date: DateTime, activities: Activity[], totalDuration: number }[] = [];
    
    if (dateRange.from && dateRange.to) {
      let current = dateRange.from.startOf('day');
      const end = dateRange.to.endOf('day');
      
      while (current <= end) {
        const dateKey = current.toISODate();
        if (dateKey && groups[dateKey]) {
          filledGroups.push(groups[dateKey]);
        } else if (dateKey) {
             filledGroups.push({
               date: current,
               activities: [],
               totalDuration: backendTotalsMap.get(dateKey) ?? 0,
             });
        }
        current = current.plus({ days: 1 });
      }
      // Sort by date descending (or ascending if they want mon-sun) - let's keep descending to show latest first
      return filledGroups.sort((a, b) => b.date.toMillis() - a.date.toMillis());
    }

    return Object.values(groups).sort((a, b) => b.date.toMillis() - a.date.toMillis());
  }, [cachedActivities, fetchedActivities, preset, dateRange, timesheetTotals]);

  // Total is the sum of backend-provided ms across all days in view
  const totalViewDurationMs = useMemo(() => {
    return timesheetTotals.reduce((acc, t) => acc + t.totalMs, 0);
  }, [timesheetTotals]);

  const formatTime = (isoString: string) => {
    return DateTime.fromISO(isoString).toFormat('h:mm a');
  };

  const getDayName = (date: DateTime) => {
    return date.toFormat('cccc, MMMM d'); // e.g. Friday, February 20
  };

  const getActivityIcon = (activity: Activity) => {
    // Check title/type for specific icons
    const title = activity.title?.toLowerCase() || '';
    const type = activity.type?.toLowerCase() || '';
    
    if (title.includes('clock') || title.includes('session started')) return <PlayCircle className="w-5 h-5 text-green-500" />;
    if (title.includes('session ended') || title.includes('clock out')) return <StopCircle className="w-5 h-5 text-red-500" />;
    
    if (title.includes('started ticket') || title.includes('ticket started')) return <PlayCircle className="w-5 h-5 text-blue-500" />;
    if (title.includes('stopped ticket') || title.includes('ticket stopped')) return <CheckCircle2 className="w-5 h-5 text-indigo-500" />;
    
    if (title.includes('break started')) return <PauseCircle className="w-5 h-5 text-orange-500" />;
    if (title.includes('break ended')) return <PlayCircle className="w-5 h-5 text-green-500" />;
    
    return <Clock className="w-5 h-5 text-gray-500" />;
  };
  
  const getActivityTitle = (activity: Activity) => {
      // Use the actual title from the activity since type is often just 'SESSION'
      return activity.title || 'General Work';
  };

  const shouldShowDuration = (activity: Activity): boolean => {
    const title = (activity.title || '').toLowerCase();
    return (
      title.includes('session ended') ||
      title.includes('clock out') ||
      title.includes('stopped ticket') ||
      title.includes('ticket stopped') ||
      title.includes('break ended')
    );
  };

  return (
    <div className="max-w-4xl mx-auto px-0 py-2 space-y-4">
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm mx-4 md:mx-0 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
         <DateRangePicker 
           initialPreset={preset}
           onRangeChange={handleRangeChange}
           className="w-full md:w-auto"
         />
         
         <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">Total Hours:</span>
            <span className="text-lg font-bold text-gray-900 dark:text-white">
              {formatDurationMs(totalViewDurationMs)}
            </span>
         </div>
      </div>

      <div className="space-y-6">
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-500">Loading timesheet data...</p>
          </div>
        ) : groupedActivities.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-2xl shadow-sm">
            <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">No entries found</h3>
            <p className="text-gray-500 dark:text-gray-400">Try adjusting the date range to see more entries.</p>
          </div>
        ) : (
          groupedActivities.map((group) => (
            <div key={group.date.toISODate()} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
              <div className="bg-gray-50 dark:bg-gray-700/50 p-4 flex justify-between items-center border-b border-gray-100 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-500" />
                  {getDayName(group.date)}
                </h3>
                <span className="text-sm font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-full min-w-[6rem] text-center">
                  {formatDurationMs(group.totalDuration)}
                </span>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {group.activities.map((activity) => (
                  <div key={activity.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors flex items-start gap-4">
                    <div className="mt-1 p-2 bg-gray-100 dark:bg-gray-700 rounded-full">
                      {getActivityIcon(activity)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white truncate">
                             {getActivityTitle(activity)}
                          </p>
                          {activity.subtitle && (
                             <p className="text-sm text-blue-600 dark:text-blue-400">
                               {activity.subtitle}
                             </p>
                          )}
                           {activity.description && (
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">
                              &quot;{activity.description}&quot;
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                            {shouldShowDuration(activity) && (
                              <div className="text-sm font-medium text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full min-w-[6rem] text-center">
                                {activity.duration && activity.duration !== '0m' && activity.duration !== '0h 0m'
                                  ? activity.duration
                                  : '0h 0m'}
                              </div>
                            )}
                           <p className="text-xs text-gray-400 mt-1">
                             {formatTime(activity.startTime)}
                             {activity.endTime && ` - ${formatTime(activity.endTime)}`}
                           </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

