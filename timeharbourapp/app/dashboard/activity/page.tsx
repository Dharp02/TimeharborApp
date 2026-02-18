'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, Clock } from 'lucide-react';
import { useTeam } from '@/components/dashboard/TeamContext';
import { useClockIn } from '@/components/dashboard/ClockInContext';
import { DateRangePicker, DateRange, DateRangePreset } from '@/components/DateRangePicker';
import * as API from '@/TimeharborAPI';
import { Activity } from '@/TimeharborAPI/dashboard';
import { isWithinInterval, startOfDay, endOfDay } from 'date-fns';

export default function ActivityPage() {
  const { currentTeam } = useTeam();
  const { isSessionActive, activeTicketTitle, sessionStartTime, sessionDuration } = useClockIn();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [visibleCount, setVisibleCount] = useState(20);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>({ from: startOfDay(new Date()), to: endOfDay(new Date()) });
  const [preset, setPreset] = useState<DateRangePreset>('today');

  useEffect(() => {
    const fetchActivity = async () => {
      try {
        setLoading(true);
        const data = await API.dashboard.getActivity(currentTeam?.id, 'all');
        setActivities(data);
      } catch (error) {
        console.error('Error fetching activity:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchActivity();
  }, [currentTeam?.id]);

  const handleRangeChange = (range: DateRange, newPreset: DateRangePreset) => {
    setDateRange(range);
    setPreset(newPreset);
    setVisibleCount(20); // Reset visible count on filter change
  };

  // Filter by date range (client-side for now)
  // We filter original activities first
  const filteredActivities = activities.filter(activity => {
      if (!activity.startTime) return false;
      const activityDate = new Date(activity.startTime);
      // Ensure we compare dates correctly
      return isWithinInterval(activityDate, { start: dateRange.from, end: dateRange.to });
  });

  let displayActivities = [...filteredActivities];
  
  // If there's an active session locally, ensure it's displayed at the top
  // We check if the API already returned an active session to avoid duplicates
  // Note: We check against *original* activities to know if API is aware, 
  // but we only display it if it falls within our filter (or always if active?)
  // For now, let's respect the filter. If user selects 'Yesterday', active session (today) is hidden.
  const apiHasActiveSession = activities.some(a => a.status === 'Active');
  
  // Check if current active session falls within selected range
  const now = new Date();
  const isActiveSessionInView = isWithinInterval(now, { start: dateRange.from, end: dateRange.to });

  if (isSessionActive && !apiHasActiveSession && isActiveSessionInView) {
    const startTime = sessionStartTime ? new Date(sessionStartTime).toISOString() : now.toISOString();
    
    const activeActivity: Activity = {
      id: 'local-active-session',
      type: 'SESSION',
      title: 'Work Session',
      subtitle: activeTicketTitle ? `Working on: ${activeTicketTitle}` : 'Clocked In',
      startTime: startTime,
      status: 'Active',
      duration: sessionDuration
    };
    
    displayActivities.unshift(activeActivity);
  } else if (isSessionActive && apiHasActiveSession) {
    // If API has active session, it might be in displayActivities (if filtered in)
    const index = displayActivities.findIndex(a => a.status === 'Active');
    if (index !== -1) {
      displayActivities[index] = {
        ...displayActivities[index],
        subtitle: activeTicketTitle ? `Working on: ${activeTicketTitle}` : displayActivities[index].subtitle,
        duration: sessionDuration
      };
    }
  } else if (!isSessionActive && apiHasActiveSession) {
    // Optimistic update for just-finished session
    const index = displayActivities.findIndex(a => a.status === 'Active');
    if (index !== -1) {
      displayActivities[index] = {
        ...displayActivities[index],
        status: 'Completed',
        endTime: new Date().toISOString(),
        subtitle: displayActivities[index].subtitle || 'Session ended'
      };
    }
  }

  const showedActivities = displayActivities.slice(0, visibleCount);
  const hasMore = displayActivities.length > visibleCount;

  const handleShowMore = () => {
    setVisibleCount(prev => prev + 20);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString([], { month: 'numeric', day: 'numeric', year: 'numeric' });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  return (
    <div className="-mt-2 md:-mt-0 px-0 md:px-4 py-4 w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 px-2 md:px-0">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 block md:block">My Activity</h1>
        <DateRangePicker 
            initialPreset={preset}
            onRangeChange={handleRangeChange}
            className="w-full sm:w-auto"
        />
      </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-100 dark:bg-gray-700/50 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : displayActivities.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400 text-left py-8 pl-4">No activity found</p>
      ) : (
        <div className="space-y-0 divide-y divide-gray-100 dark:divide-gray-800 w-full max-w-none">
          {showedActivities.map((activity) => (
            <div 
              key={activity.id}
              className={`py-4 px-2 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors w-full ${
                activity.status === 'Active'
                  ? 'bg-green-50/50 dark:bg-green-900/10'
                  : ''
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 p-2 rounded-full flex-shrink-0 ${
                  activity.status === 'Active' ? 'bg-green-100 text-green-600' : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                }`}>
                  <Clock className="w-5 h-5" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white text-base leading-tight">
                        {activity.title}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5 truncate">
                        {activity.subtitle}
                      </p>
                    </div>
                    
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-medium text-gray-900 dark:text-gray-100">
                        {formatDate(activity.startTime)}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {formatTime(activity.startTime)}
                        {activity.endTime ? ` - ${formatTime(activity.endTime)}` : ' - Now'}
                      </p>
                    </div>
                  </div>

                  {activity.description && (
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mt-1.5 line-clamp-2">
                      &quot;{activity.description}&quot;
                    </p>
                  )}

                  <div className="flex items-center gap-2 mt-2">
                    {activity.status === 'Active' && (
                      <span className="px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 rounded-md">
                        Active
                      </span>
                    )}
                    {activity.duration && (
                      <div className={`text-xs font-mono font-medium ${
                        activity.status === 'Active'
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-gray-500 dark:text-gray-400'
                      }`}>
                        {activity.duration}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
          
          {hasMore && (
            <button
              onClick={handleShowMore}
              className="w-full py-3 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-xl transition-colors"
            >
              Show More
            </button>
          )}
        </div>
      )}
    </div>
  );
}
