'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ChevronLeft, Clock, Loader2 } from 'lucide-react';
import { useActivityLog } from '@/components/dashboard/ActivityLogContext';
import { DateRangePicker, DateRange, DateRangePreset } from '@/components/DateRangePicker';
import { DateTime } from 'luxon';
import { Activity } from '@/TimeharborAPI/dashboard';
import { useRefresh } from '@/contexts/RefreshContext';

export default function ActivityPage() {
  const { activities: cachedActivities, fetchActivitiesByDateRange } = useActivityLog();
  const { register, lastRefreshed } = useRefresh();
  const [visibleCount, setVisibleCount] = useState(20);
  const [dateRange, setDateRange] = useState<DateRange>({ 
    from: DateTime.now().startOf('day'), 
    to: DateTime.now().endOf('day') 
  });
  const [preset, setPreset] = useState<DateRangePreset>('today');
  const [fetchedActivities, setFetchedActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchFilteredData = useCallback(async () => {
      if (preset === 'today') {
        // Use cached data for today
        setFetchedActivities(cachedActivities);
        return;
      }

      if (!dateRange.from || !dateRange.to) return;

      setIsLoading(true);
      try {
        const data = await fetchActivitiesByDateRange(
          dateRange.from.toISO() || '',
          dateRange.to.toISO() || ''
        );
        setFetchedActivities(data);
      } catch (error) {
        console.error('Failed to fetch activities:', error);
      } finally {
        setIsLoading(false);
      }
  }, [preset, cachedActivities, dateRange, fetchActivitiesByDateRange]);

  useEffect(() => {
    fetchFilteredData();
    
    // Register so that refreshAll() calls this fetch logic
    const unregister = register(async () => {
        await fetchFilteredData();
    });

    return unregister;
  }, [fetchFilteredData, register, lastRefreshed]);

  const handleRangeChange = (range: DateRange, newPreset: DateRangePreset) => {
    setDateRange(range);
    setPreset(newPreset);
    setVisibleCount(20); // Reset visible count on filter change
  };

  const formatDate = (dateString: string) => {
    return DateTime.fromISO(dateString).toFormat('M/d/yyyy');
  };

  const formatTime = (dateString: string) => {
    return DateTime.fromISO(dateString).toFormat('h:mm a');
  };

  // Filter by date range (client-side for today's cached data, or just use fetched data)
  const filteredActivities = preset === 'today' ? cachedActivities.filter(activity => {
      if (!activity.startTime) return false;
      const activityTime = DateTime.fromISO(activity.startTime).toMillis();
      
      // Ensure we compare dates correctly
      if (!dateRange.from || !dateRange.to) return true;
      
      const start = dateRange.from.toMillis();
      const end = dateRange.to.toMillis();
      
      return activityTime >= start && activityTime <= end;
  }) : fetchedActivities;

  const displayActivities = filteredActivities.slice(0, visibleCount);
  const hasMore = filteredActivities.length > visibleCount;

  const loadMore = () => {
    setVisibleCount(prev => prev + 20);
  };

  return (
    <div className="max-w-4xl mx-auto px-0 py-2 md:p-6 space-y-4">
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm">
        <div className="flex-1 w-full md:w-auto">
           <DateRangePicker 
             initialPreset={preset}
             onRangeChange={handleRangeChange}
             className="w-full md:w-auto"
           />
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Showing {displayActivities.length} of {filteredActivities.length} events
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-gray-500 dark:text-gray-400 flex flex-col items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-4" />
            <p>Loading activities...</p>
          </div>
        ) : cachedActivities.length === 0 && preset === 'today' ? (
          <div className="p-12 text-center text-gray-500 dark:text-gray-400">
            <Clock className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
            <p className="text-lg font-medium">No activity recorded yet</p>
            <p className="text-sm mt-1">Clock in or start working on tickets to see activity here.</p>
          </div>
        ) : filteredActivities.length === 0 ? (
          <div className="p-12 text-center text-gray-500 dark:text-gray-400">
            <p>No activity found for the selected date range.</p>
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
                            Active Session
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {activity.subtitle}
                      </p>
                       {activity.description && (
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
                    <div className={`px-3 py-1 rounded-lg text-sm font-mono font-medium whitespace-nowrap ${
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
            <button 
              onClick={loadMore}
              className="px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
            >
              Load More
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
