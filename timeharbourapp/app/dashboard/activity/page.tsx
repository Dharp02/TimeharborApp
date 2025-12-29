'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, Clock } from 'lucide-react';
import { useTeam } from '@/components/dashboard/TeamContext';
import { useClockIn } from '@/components/dashboard/ClockInContext';
import * as API from '@/TimeharborAPI';
import { Activity } from '@/TimeharborAPI/dashboard';

export default function ActivityPage() {
  const { currentTeam } = useTeam();
  const { isSessionActive, activeTicketTitle, sessionStartTime, sessionDuration } = useClockIn();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

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

  // Combine API activities with local active session
  let displayActivities = [...activities];
  
  // If there's an active session locally, ensure it's displayed at the top
  // We check if the API already returned an active session to avoid duplicates
  const apiHasActiveSession = activities.some(a => a.status === 'Active');
  
  if (isSessionActive && !apiHasActiveSession) {
    const now = new Date();
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
    // If API has active session, update its duration and subtitle from local state for better responsiveness
    const index = displayActivities.findIndex(a => a.status === 'Active');
    if (index !== -1) {
      displayActivities[index] = {
        ...displayActivities[index],
        subtitle: activeTicketTitle ? `Working on: ${activeTicketTitle}` : displayActivities[index].subtitle,
        duration: sessionDuration
      };
    }
  } else if (!isSessionActive && apiHasActiveSession) {
    // Optimistic update: If we are not active locally, but API says active, 
    // it means we just clocked out and are waiting for the server to update.
    // Show it as completed optimistically to prevent "vanishing" or "flashing".
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString([], { month: 'numeric', day: 'numeric', year: 'numeric' });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <Link 
          href="/dashboard" 
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
        >
          <ChevronLeft className="w-6 h-6 text-gray-600 dark:text-gray-300" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">All Activity</h1>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-4 md:p-6">
        {loading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-100 dark:bg-gray-700/50 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : displayActivities.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-8">No activity found</p>
        ) : (
          <div className="space-y-4">
            {displayActivities.map((activity) => (
              <div 
                key={activity.id}
                className={`p-4 rounded-xl border transition-colors ${
                  activity.status === 'Active'
                    ? 'bg-green-50 dark:bg-green-900/10 border-green-100 dark:border-green-900/30'
                    : 'bg-gray-50 dark:bg-gray-700/30 border-gray-100 dark:border-gray-700'
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
                        <h3 className="font-semibold text-gray-900 dark:text-white text-base">
                          {activity.title}
                        </h3>
                        {activity.status === 'Active' && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 rounded-full">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                        {activity.subtitle}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        {formatDate(activity.startTime)}, {formatTime(activity.startTime)}
                        {activity.endTime ? ` - ${formatTime(activity.endTime)}` : ' - Now'}
                      </p>
                    </div>
                  </div>
                  
                  {activity.duration && (
                    <div className={`px-3 py-1 rounded-lg text-sm font-mono font-medium ${
                      activity.status === 'Active'
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
                    }`}>
                      {activity.duration}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
