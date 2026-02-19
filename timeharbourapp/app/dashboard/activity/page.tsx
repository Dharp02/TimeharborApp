'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, Clock } from 'lucide-react';
import { useActivityLog } from '@/components/dashboard/ActivityLogContext';
import { DateRangePicker, DateRange, DateRangePreset } from '@/components/DateRangePicker';
import { isWithinInterval, startOfDay, endOfDay } from 'date-fns';

export default function ActivityPage() {
  const { activities } = useActivityLog();
  const [visibleCount, setVisibleCount] = useState(20);
  const [dateRange, setDateRange] = useState<DateRange>({ from: startOfDay(new Date()), to: endOfDay(new Date()) });
  const [preset, setPreset] = useState<DateRangePreset>('today');

  const handleRangeChange = (range: DateRange, newPreset: DateRangePreset) => {
    setDateRange(range);
    setPreset(newPreset);
    setVisibleCount(20); // Reset visible count on filter change
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString([], { month: 'numeric', day: 'numeric', year: 'numeric' });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  // Filter by date range (client-side)
  const filteredActivities = activities.filter(activity => {
      if (!activity.startTime) return false;
      const activityDate = new Date(activity.startTime);
      // Ensure we compare dates correctly
      if (!dateRange.from || !dateRange.to) return true;
      return isWithinInterval(activityDate, { start: dateRange.from, end: dateRange.to });
  });

  const displayActivities = filteredActivities.slice(0, visibleCount);
  const hasMore = filteredActivities.length > visibleCount;

  const loadMore = () => {
    setVisibleCount(prev => prev + 20);
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <Link 
          href="/dashboard" 
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Activity Log</h1>
      </div>

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
        {activities.length === 0 ? (
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
