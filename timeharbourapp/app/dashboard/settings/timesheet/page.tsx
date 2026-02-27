'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useActivityLog } from '@/components/dashboard/ActivityLogContext';
import { DateRangePicker, DateRange, DateRangePreset } from '@/components/DateRangePicker';
import { DateTime } from 'luxon';
import { Activity } from '@/TimeharborAPI/dashboard';
import { ChevronRight, Clock, Calendar, CheckCircle2, PauseCircle, PlayCircle, StopCircle } from 'lucide-react';
import Link from 'next/link';
import { useRefresh } from '../../../../contexts/RefreshContext';

export default function TimesheetPage() {
  const { activities: cachedActivities, fetchActivitiesByDateRange } = useActivityLog();
  const { register, lastRefreshed } = useRefresh();
  const [dateRange, setDateRange] = useState<DateRange>({ 
    from: DateTime.now().startOf('day'),
    to: DateTime.now().endOf('day') 
  });
  const [preset, setPreset] = useState<DateRangePreset>('today');
  const [fetchedActivities, setFetchedActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(false);

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
    
    // Sort by time descending
    const sorted = [...activitiesToDisplay].sort((a, b) => {
      const timeA = DateTime.fromISO(a.startTime).toMillis();
      const timeB = DateTime.fromISO(b.startTime).toMillis();
      return timeB - timeA;
    });

    // Chronological sort for calculating durations
    const chronological = [...activitiesToDisplay].sort((a, b) => {
      const timeA = DateTime.fromISO(a.startTime).toMillis();
      const timeB = DateTime.fromISO(b.startTime).toMillis();
      return timeA - timeB;
    });

    const groups: { [key: string]: { date: DateTime, activities: Activity[], totalDuration: number } } = {};

    // Calculate durations using chronological order
    const dateDurations: { [key: string]: number } = {};
    let isClockedIn = false;
    let lastTime = 0;

    chronological.forEach(activity => {
      if (!activity.startTime) return;
      const activityTime = DateTime.fromISO(activity.startTime).toMillis();
      const dateKey = DateTime.fromISO(activity.startTime).startOf('day').toISODate();
      
      if (!dateKey) return;
      if (!dateDurations[dateKey]) dateDurations[dateKey] = 0;

      // Determine activity type
      const title = (activity.title || '').toLowerCase();
      const type = (activity.type || '').toLowerCase();
      
      // Note: We intentionally skip reading 'activity.duration' from server events (like Session Ended)
      // because it can cause double-counting when we also calculate durations manually from timestamps.
      // The manual calculation (time diffs) provides a more consistent total for mixed ticket/session events.

      const isStart = title.includes('clock in') || title.includes('session started') || title.includes('ticket started') || title.includes('started ticket');
      const isStop = title.includes('clock out') || title.includes('session ended'); // Remove "Stopped Ticket" from here!
      const isBreakEnd = title.includes('break ended');
      
      // "Stopped Ticket" events should NOT automatically clock you out in the duration calculation
      // unless followed by a clock out. The dashboard controller considers you "clocked in" 
      // even after stopping a ticket, until you explicitly clock out.
      
      // However, if the user manually stopped a ticket and then went idle, 
      // we might overcount. But to MATCH DASHBOARD, we must follow its logic:
      // Dashboard: STOP_TICKET -> isClockedIn = true.

      // NOTE: "START_TICKET" is treated as a start event, but stopping a ticket doesn't stop the clock.
      // So if you Clock In, then Start Ticket, you have two "Starts".
      // Dashboard counts the time between Clock In and Start Ticket as valid work time.
      // So we should NOT treat this as a "Double Start" error unless it's literally two CLOCK_INs or SESSION_STARTEDs.

      // Refine isStart check for "Double Start" logic only
      const isSessionStart = title.includes('clock in') || title.includes('session started');
      
      if (isClockedIn && lastTime > 0) {
        // Calculate potential duration
        const duration = (activityTime - lastTime) / 1000; // in seconds
        
        // Only consider it a "Double Start" error if we see another SESSION START (Clock In) while already clocked in.
        // Starting a ticket while clocked in is normal workflow and the gap should be counted.
        const isDoubleSessionStart = isClockedIn && (isSessionStart || isBreakEnd); // Start Ticket is excluded here

        if (isDoubleSessionStart) {
             // We found a Session Start event but thought we were already running.
             // Assume the gap was NOT work time (e.g. forgot to clock out, then clocked in again).
             // Do NOT add duration.
             // Reset state is implicitly handled below.
        } else if (duration < 14 * 3600) { 
             // Only count if less than 14 hours (safety cap)
             dateDurations[dateKey] += duration;
        }
      }
      
      // Update state
      if (isStart || isBreakEnd) {
        isClockedIn = true;
      } else if (isStop || title.includes('break started')) {
        isClockedIn = false;
      }
      // Note: "Stopped Ticket" does not change isClockedIn status, keeping you clocked in.
      
      lastTime = activityTime;
    });

    // Handle currently active session (if last event left us clocked in)
    // Only for "Today" preset to match dashboard "real-time" feel
    if (isClockedIn && lastTime > 0 && preset === 'today') {
       const now = DateTime.now().toMillis();
       const duration = (now - lastTime) / 1000;
       const todayKey = DateTime.now().startOf('day').toISODate();
       if (todayKey && dateDurations[todayKey]) {
          dateDurations[todayKey] += duration;
       }
    }

    sorted.forEach(activity => {
      if (!activity.startTime) return;
      const date = DateTime.fromISO(activity.startTime).startOf('day');
      const dateKey = date.toISODate();
      
      if (!dateKey) return;

      if (!groups[dateKey]) {
        groups[dateKey] = {
          date,
          activities: [],
          totalDuration: 0 // Will be set from dateDurations
        };
      }

      groups[dateKey].activities.push(activity);
      
      // If activity has explicit duration string, we could use that for display,
      // but for daily total we use the calculated dateDurations logic above.
    });

    // Assign calculated totals to groups
    Object.keys(groups).forEach(key => {
      groups[key].totalDuration = dateDurations[key] || 0;
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
               totalDuration: 0
             });
        }
        current = current.plus({ days: 1 });
      }
      // Sort by date descending (or ascending if they want mon-sun) - let's keep descending to show latest first
      return filledGroups.sort((a, b) => b.date.toMillis() - a.date.toMillis());
    }

    return Object.values(groups).sort((a, b) => b.date.toMillis() - a.date.toMillis());
  }, [cachedActivities, fetchedActivities, preset, dateRange]);

  const totalViewDuration = useMemo(() => {
    return groupedActivities.reduce((acc, group) => acc + group.totalDuration, 0);
  }, [groupedActivities]);

  const formatDuration = (seconds: number) => {
    // Round seconds to nearest integer to align with server calculation which uses milliseconds
    // Also consider rounding up to next minute if close to boundary, or just standard rounding
    const totalSeconds = Math.round(seconds);
    
    const hours = Math.floor(totalSeconds / 3600);
    // Use modulo correctly for remaining minutes
    const remainingSeconds = totalSeconds % 3600;
    const minutes = Math.floor(remainingSeconds / 60);

    return `${hours}h ${minutes}m`;
  };

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
              {formatDuration(totalViewDuration)}
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
                  {formatDuration(group.totalDuration)}
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
                            <div className="text-sm font-medium text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full min-w-[6rem] text-center">
                                {/* Use exact duration if available and not 0, otherwise calculate fallback */}
                                {activity.duration && activity.duration !== '0m' && activity.duration !== '0h 0m' 
                                  ? activity.duration 
                                  : '0h 0m'}
                            </div>
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

