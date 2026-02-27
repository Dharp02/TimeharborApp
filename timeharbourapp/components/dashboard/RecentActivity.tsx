'use client';

import Link from 'next/link';
import { ChevronRight, Clock } from 'lucide-react';
import { useActivityLog } from './ActivityLogContext';

export default function RecentActivity() {
  const { activities } = useActivityLog();

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString([], { month: 'numeric', day: 'numeric', year: 'numeric' });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  // Helper to format duration if needed, though most activities might pre-calculate it
  const formatDuration = (ms: number) => {
      const hours = Math.floor(ms / (1000 * 60 * 60));
      const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
      return `${hours}h ${minutes}m`;
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-4 md:p-6">
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <h2 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          Recent Activity
        </h2>
      </div>

      <div className="space-y-3 md:space-y-4">
        {activities.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-4">No recent activity</p>
        ) : (
          activities.slice(0, 10).map((activity) => (
            <div 
              key={activity.id}
              className={`p-3 md:p-4 rounded-xl border transition-colors ${
                activity.status === 'Active'
                  ? 'bg-green-50 dark:bg-green-900/10 border-green-100 dark:border-green-900/30'
                  : 'bg-gray-50 dark:bg-gray-700/30 border-gray-100 dark:border-gray-700'
              }`}
            >
              <div className="flex items-start justify-between gap-3 md:gap-4">
                <div className="flex items-start gap-3">
                  <div className={`mt-1 p-1.5 rounded-full ${
                    activity.status === 'Active' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'
                  }`}>
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-900 dark:text-white text-sm md:text-base">
                        {activity.title}
                      </h3>
                      {activity.status === 'Active' && (
                        <span className="px-2 py-0.5 text-[10px] md:text-xs font-medium bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 rounded-full">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                      {activity.subtitle}
                    </p>
                    {activity.description && (
                      <p className="text-sm md:text-base font-bold text-gray-700 dark:text-gray-200 mt-0.5">
                        "{activity.description}"
                      </p>
                    )}
                    {activity.link && (
                      <a
                        href={activity.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 mt-1 text-xs text-blue-600 dark:text-blue-400 hover:underline break-all"
                      >
                        🔗 {activity.link}
                      </a>
                    )}
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      {formatDate(activity.startTime)}, {formatTime(activity.startTime)}
                      {activity.endTime ? ` - ${formatTime(activity.endTime)}` : ''}
                    </p>
                  </div>
                </div>
                
                {activity.duration && (
                  <div className={`px-2 md:px-3 py-1 rounded-lg text-xs md:text-sm font-mono font-medium ${
                    activity.status === 'Active'
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
                  }`}>
                    {activity.duration}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
      
      <div className="mt-4 flex justify-end">
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
