'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, CheckCircle, LogIn, LogOut, Clock } from 'lucide-react';
import { useTeam } from './TeamContext';
import { useClockIn } from './ClockInContext';
import * as API from '@/TimeharborAPI';
import { Activity } from '@/TimeharborAPI/dashboard';

export default function RecentActivity() {
  const { currentTeam } = useTeam();
  const { isSessionActive, activeTicketTitle, sessionStartTime, sessionDuration } = useClockIn();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const fetchActivity = async () => {
      try {
        if (activities.length === 0) {
          setLoading(true);
        } else {
          setIsRefreshing(true);
        }
        
        const data = await API.dashboard.getActivity(currentTeam?.id);
        setActivities(data);
      } catch (error) {
        console.error('Error fetching recent activity:', error);
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    };

    // If session just ended, wait a bit for sync to complete before fetching
    if (!isSessionActive) {
      const timer = setTimeout(() => {
        fetchActivity();
      }, 1000); // Wait 1 second for sync
      return () => clearTimeout(timer);
    } else {
      fetchActivity();
    }
  }, [currentTeam?.id, isSessionActive]); // Re-fetch when session state changes

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

  if (loading) {
    return <div className="h-64 bg-white dark:bg-gray-800 rounded-2xl shadow-sm animate-pulse" />;
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-4 md:p-6">
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <h2 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          Recent Activity
          {isRefreshing && (
            <div className="w-3 h-3 md:w-4 md:h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          )}
        </h2>
        <Link 
          href="/dashboard/activity" 
          className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1"
        >
          See All <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="space-y-3 md:space-y-4">
        {displayActivities.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-4">No recent activity</p>
        ) : (
          displayActivities.map((activity) => (
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
                      <p className="text-xs md:text-sm text-gray-600 dark:text-gray-300 mt-0.5 italic">
                        "{activity.description}"
                      </p>
                    )}
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      {formatDate(activity.startTime)}, {formatTime(activity.startTime)}
                      {activity.endTime ? ` - ${formatTime(activity.endTime)}` : ' - Now'}
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
    </div>
  );
}
