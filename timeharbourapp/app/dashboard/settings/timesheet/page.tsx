'use client';

import { useState, useMemo, useEffect } from 'react';
import { useTeam } from '@/components/dashboard/TeamContext';
import { DateRangePickerWithPresets } from '@/components/DateRangePickerWithPresets';
import { DateTime } from 'luxon';
import { dateFilterPresets, resolveRange, type LuxonDateRange } from '@/lib/datePresets';
import { Activity, fetchActivitiesByDateRange, getTimesheetTotals, TimesheetDayTotal } from '@/TimeharborAPI/dashboard';
import { formatDurationMs } from '@/lib/formatDuration';
import { Clock, Calendar, CheckCircle2, ChevronDown, PauseCircle, PlayCircle, StopCircle, WifiOff } from 'lucide-react';
import { useRefresh } from '../../../../contexts/RefreshContext';
import { useSocket } from '@/contexts/SocketContext';

export default function TimesheetPage() {
  const { currentTeam } = useTeam();
  const { register, lastRefreshed } = useRefresh();
  const { isOnline } = useSocket();
  const [dateRange, setDateRange] = useState<LuxonDateRange>({ 
    from: DateTime.now().startOf('day'),
    to: DateTime.now().endOf('day') 
  });
  const [preset, setPreset] = useState<string>('today');
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  /** Per-day totalMs from backend (UserDailyStat), break-excluded */
  const [timesheetTotals, setTimesheetTotals] = useState<TimesheetDayTotal[]>([]);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

  const toggleDay = (dateKey: string) => {
    setExpandedDays(prev => {
      const next = new Set(prev);
      if (next.has(dateKey)) next.delete(dateKey);
      else next.add(dateKey);
      return next;
    });
  };

  // Fetch both activities and per-day totals from the API whenever the date range changes.
  useEffect(() => {
    if (!currentTeam?.id || !dateRange.from || !dateRange.to) return;

    const from = dateRange.from.toISODate();
    const to = dateRange.to.toISODate();
    if (!from || !to) return;

    const loadData = async () => {
      setIsLoading(true);
      try {
        const [acts, totals] = await Promise.all([
          fetchActivitiesByDateRange(
            currentTeam.id,
            dateRange.from!.toISO() || '',
            dateRange.to!.toISO() || '',
          ),
          getTimesheetTotals(from, to, currentTeam.id),
        ]);
        setActivities(acts);
        setTimesheetTotals(totals);
      } catch (e) {
        console.error('Failed to load timesheet data:', e);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();

    const unregister = register(loadData);
    return unregister;
  }, [dateRange, currentTeam?.id, lastRefreshed, register]);

  const handleRangeChange = (range: { start: Date | null; end: Date | null }, presetKey?: string) => {
    setDateRange(resolveRange(range, presetKey));
    setPreset(presetKey || '');
  };

  // Group activities by day
  const groupedActivities = useMemo(() => {
    const activitiesToDisplay = activities;

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
  }, [activities, dateRange, timesheetTotals]);

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
    
    if (title.includes('started ticket') || title.includes('ticket started')) return <PlayCircle className="w-5 h-5 text-primary-500" />;
    if (title.includes('stopped ticket') || title.includes('ticket stopped')) return <CheckCircle2 className="w-5 h-5 text-primary-500" />;
    
    if (title.includes('break started')) return <PauseCircle className="w-5 h-5 text-orange-500" />;
    if (title.includes('break ended')) return <PlayCircle className="w-5 h-5 text-green-500" />;
    
    return <Clock className="w-5 h-5 text-gray-500" />;
  };
  
  const getActivityTitle = (activity: Activity) => {
      // Use the actual title from the activity since type is often just 'SESSION'
      return activity.title || 'General Work';
  };

  // Only show the duration badge on session-end events where we have a real computed duration.
  // Break events are intentionally excluded — break time is not work time.
  const shouldShowDuration = (activity: Activity): boolean => {
    const title = (activity.title || '').toLowerCase();
    return (
      (title.includes('session ended') || title.includes('clock out')) &&
      !!activity.duration &&
      activity.duration !== '0h 0m'
    );
  };

  /**
   * Computes a human-readable "Xh Ym Zs" string from the activity's own
   * startTime → endTime. Returns null if there's no endTime or the span is < 1s.
   * This is purely informational and does NOT affect any totals.
   */
  const getTimeSpent = (activity: Activity): string | null => {
    if (!activity.endTime) return null;
    const title = (activity.title || '').toLowerCase();
    // Skip break periods — idle time, not work time
    if (title.includes('on break') || title.includes('break started') || title.includes('session paused')) return null;
    // Skip start events — their endTime is the session end, not their own transition,
    // so the span always includes any subsequent breaks and is misleading.
    if (
      title.includes('work session started') ||
      title.includes('clocked in') ||
      title.includes('clock in') ||
      title.includes('started ticket') ||
      title.includes('ticket started')
    ) return null;
    const ms = DateTime.fromISO(activity.endTime).toMillis() - DateTime.fromISO(activity.startTime).toMillis();
    if (ms < 1000) return null;
    const totalSeconds = Math.floor(ms / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  return (
    <div className="max-w-4xl mx-auto px-0 py-2 space-y-4">
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
         <DateRangePickerWithPresets 
           value={{ start: dateRange.from.toJSDate(), end: dateRange.to.toJSDate() }}
           onChange={handleRangeChange}
           activePreset={preset}
           presets={dateFilterPresets}
           variant="responsive"
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
        {!isOnline ? (
          <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-2xl shadow-sm">
            <WifiOff className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">You&apos;re offline</h3>
            <p className="text-gray-500 dark:text-gray-400 mt-1">Come online to view your timesheet.</p>
          </div>
        ) : isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-500">Loading timesheet data...</p>
          </div>
        ) : groupedActivities.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-2xl shadow-sm">
            <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">No entries found</h3>
            <p className="text-gray-500 dark:text-gray-400">Try adjusting the date range to see more entries.</p>
          </div>
        ) : (
          groupedActivities.map((group) => {
            const dateKey = group.date.toISODate() || '';
            const isExpanded = expandedDays.has(dateKey);
            return (
            <div key={dateKey} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
              <button
                type="button"
                onClick={() => toggleDay(dateKey)}
                className="w-full bg-gray-50 dark:bg-gray-700/50 p-4 flex justify-between items-center border-b border-gray-100 dark:border-gray-700 cursor-pointer"
                aria-expanded={isExpanded}
                aria-label={`${getDayName(group.date)}, ${formatDurationMs(group.totalDuration)}. ${group.activities.length} events`}
              >
                <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary-500" />
                  {getDayName(group.date)}
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 px-3 py-1 rounded-full min-w-[6rem] text-center">
                    {formatDurationMs(group.totalDuration)}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                </div>
              </button>
              {isExpanded && <div className="divide-y divide-gray-100 dark:divide-gray-800">
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
                             <p className="text-sm text-primary-600 dark:text-primary-400">
                               {activity.subtitle}
                             </p>
                          )}
                           {activity.description && (
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">
                              &quot;{activity.description}&quot;
                            </p>
                          )}
                          {(() => {
                            const spent = getTimeSpent(activity);
                            return spent ? (
                              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                                Time spent: <span className="font-medium text-gray-500 dark:text-gray-400">{spent}</span>
                              </p>
                            ) : null;
                          })()}
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
              </div>}
            </div>
            );
          })
        )}
      </div>
    </div>
  );
}

