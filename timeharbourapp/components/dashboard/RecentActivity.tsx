'use client';

import { useClockIn } from './ClockInContext';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

type Activity = {
  id: string;
  ticketName: string;
  teamName: string;
  startTime: string;
  endTime: string | null;
  date: string;
  duration: string;
  isActive: boolean;
};

export default function RecentActivity() {
  const { isSessionActive, activeTicketId, activeTicketTitle, ticketDuration } = useClockIn();
  const [activities, setActivities] = useState<Activity[]>([]);

  // Mock data generation
  useEffect(() => {
    const mockActivities: Activity[] = [
      {
        id: '1',
        ticketName: 'Fix login page responsiveness',
        teamName: 'Frontend Team',
        startTime: '5:26 PM',
        endTime: '5:26 PM',
        date: '12/24/2025',
        duration: '0:00',
        isActive: false,
      },
      {
        id: '2',
        ticketName: 'Update user profile API',
        teamName: 'Backend Team',
        startTime: '5:23 PM',
        endTime: '5:23 PM',
        date: '12/24/2025',
        duration: '0:00',
        isActive: false,
      },
      {
        id: '3',
        ticketName: 'Design dashboard mockups',
        teamName: 'Design Team',
        startTime: '5:17 PM',
        endTime: '5:23 PM',
        date: '12/24/2025',
        duration: '0:05',
        isActive: false,
      },
      {
        id: '4',
        ticketName: 'Implement dark mode',
        teamName: 'Frontend Team',
        startTime: '4:00 PM',
        endTime: '5:00 PM',
        date: '12/24/2025',
        duration: '1:00',
        isActive: false,
      },
      {
        id: '5',
        ticketName: 'Fix navigation bug',
        teamName: 'Frontend Team',
        startTime: '2:30 PM',
        endTime: '3:30 PM',
        date: '12/24/2025',
        duration: '1:00',
        isActive: false,
      },
      {
        id: '6',
        ticketName: 'Add unit tests',
        teamName: 'QA Team',
        startTime: '10:00 AM',
        endTime: '11:00 AM',
        date: '12/24/2025',
        duration: '1:00',
        isActive: false,
      },
    ];

    // If currently clocked in to a ticket, add active session at the top
    if (isSessionActive && activeTicketId) {
      const now = new Date();
      const activeSession: Activity = {
        id: 'active',
        ticketName: activeTicketTitle || 'Current Task',
        teamName: 'My Team',
        startTime: now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
        endTime: null,
        date: now.toLocaleDateString(),
        duration: ticketDuration,
        isActive: true,
      };
      // Combine and slice to keep only 5 items total
      setActivities([activeSession, ...mockActivities].slice(0, 5));
    } else {
      setActivities(mockActivities.slice(0, 5));
    }
  }, [isSessionActive, activeTicketId, activeTicketTitle, ticketDuration]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-4 md:p-6">
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <h2 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white">
          Recent Activity
        </h2>
        <Link href="/dashboard/activity" className="hidden md:flex items-center text-sm text-blue-600 dark:text-blue-400 hover:underline">
          See All <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="space-y-3">
        {activities.map((activity) => (
          <div
            key={activity.id}
            className={`p-4 rounded-xl border transition-all ${
              activity.isActive
                ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
                : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-start gap-3">
                {activity.isActive && (
                  <div className="mt-1.5 w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse shrink-0" />
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-gray-900 dark:text-white text-sm md:text-base">
                      {activity.ticketName}
                    </h3>
                    {activity.isActive && (
                      <span className="text-[10px] font-medium text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {activity.teamName}
                  </p>
                  <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {activity.isActive ? (
                      `${activity.date}, ${activity.startTime} - Now`
                    ) : (
                      `${activity.date}, ${activity.startTime} - ${activity.endTime}`
                    )}
                  </p>
                </div>
              </div>
              
              <div className={`px-3 py-1.5 rounded-lg text-sm font-bold font-mono ${
                activity.isActive
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
              }`}>
                {activity.duration}
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-4 md:hidden text-center">
        <Link href="/dashboard/activity" className="text-sm text-blue-600 dark:text-blue-400 font-medium">
          See All Activity
        </Link>
      </div>
    </div>
  );
}
