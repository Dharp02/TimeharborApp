'use client';

import Link from 'next/link';
import { ChevronRight, Clock, ExternalLink } from 'lucide-react';
import type { Activity } from '@/TimeharborAPI/dashboard';
import { DateTime } from 'luxon';
import { useActivityLog } from './ActivityLogContext';

const URL_REGEX = /https?:\/\/[^\s]+/g;

/** Split description into text segments and clickable URLs. */
function parseDescriptionParts(description: string): { text: string | null; urls: string[] } {
  const urls = description.match(URL_REGEX) ?? [];
  const text = description.replace(URL_REGEX, '').trim() || null;
  return { text, urls };
}

/**
 * Loads recent activity from activity_logs (via ActivityLogContext / GET /teams/:id/logs).
 * This includes work sessions AND discrete events like ticket created, team created/deleted.
 */
export default function RecentActivity() {
  const { activities: allActivities } = useActivityLog();

  // Show only today's activity; past days are available via the "See All" activity page
  const todayStart = DateTime.now().startOf('day');
  const todayEnd = DateTime.now().endOf('day');
  const activities = allActivities
    .filter((a: Activity) => {
      const dt = DateTime.fromISO(a.startTime);
      return dt >= todayStart && dt <= todayEnd;
    })
    .slice(0, 10);

  const loading = false; // ActivityLogContext manages its own loading state; treat as ready

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString([], { month: 'numeric', day: 'numeric', year: 'numeric' });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  return (
    <div className="bg-card text-card-foreground rounded-2xl shadow-sm p-4 md:p-6">
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <h2 className="text-lg md:text-xl font-bold text-foreground flex items-center gap-2">
          Recent Activity
        </h2>
      </div>

      <div className="space-y-3 md:space-y-4">
        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        ) : activities.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">No recent activity</p>
        ) : (
          activities.slice(0, 10).map((activity) => (
            <div
              key={activity.id}
              className={`p-3 md:p-4 rounded-xl border transition-colors ${
                activity.status === 'Active'
                  ? 'bg-green-50 dark:bg-green-900/10 border-green-100 dark:border-green-900/30'
                  : 'bg-muted border-border'
              }`}
            >
              <div className="flex items-start justify-between gap-3 md:gap-4">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className={`mt-1 p-1.5 rounded-full shrink-0 ${
                    activity.status === 'Active' ? 'bg-green-100 text-green-600' : 'bg-primary-100 text-primary-600'
                  }`}>
                    <Clock className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-foreground text-sm md:text-base">
                        {activity.title}
                      </h3>
                      {activity.status === 'Active' && (
                        <span className="px-2 py-0.5 text-[10px] md:text-xs font-medium bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 rounded-full">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
                      {activity.subtitle}
                    </p>
                    {(activity.description || activity.link) && (() => {
                      const parsed = activity.description ? parseDescriptionParts(activity.description) : { text: null, urls: [] };
                      // Collect all unique URLs from description + explicit link field
                      const allUrls = [...parsed.urls];
                      if (activity.link && !allUrls.includes(activity.link)) {
                        allUrls.push(activity.link);
                      }
                      return (
                        <div className="mt-1.5 p-2 bg-muted rounded-lg text-sm space-y-1">
                          {parsed.text && (
                            <p className="text-foreground">{parsed.text}</p>
                          )}
                          {allUrls.map((url) => (
                            <a
                              key={url}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-primary-600 dark:text-primary-400 hover:underline break-all"
                            >
                              <ExternalLink className="w-3 h-3 shrink-0" />
                              {url}
                            </a>
                          ))}
                        </div>
                      );
                    })()}
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDate(activity.startTime)}, {formatTime(activity.startTime)}
                      {activity.endTime ? ` - ${formatTime(activity.endTime)}` : ''}
                    </p>
                  </div>
                </div>

                {/* Duration badge — shown for CLOCK_OUT events matching the All Activity page format */}
                {activity.duration && (
                  <div className={`shrink-0 px-2 md:px-3 py-1 rounded-lg text-xs md:text-sm font-mono font-medium ${
                    activity.status === 'Active'
                      ? 'bg-green-500 text-white'
                      : 'bg-muted text-muted-foreground'
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
          className="text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 flex items-center gap-1"
        >
          See All <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
