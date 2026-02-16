'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Clock, User, Briefcase, Calendar, ExternalLink, Link as LinkIcon } from 'lucide-react';
import * as API from '@/TimeharborAPI/dashboard';
import { enhanceTicketData } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import SlidingDateFilter, { DateRangeType } from '@/components/SlidingDateFilter';

interface MemberPageProps {
  memberId?: string;
  showClockEvents?: boolean; // @deprecated
  mode?: 'view'; // 'profile' mode removed, use dashboard/settings/profile/page.tsx instead
  showBackButton?: boolean;
}

export default function MemberPageClient({ 
  memberId: propMemberId, 
  showClockEvents = true, 
  showBackButton = true 
}: MemberPageProps = {}) {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const memberId = propMemberId || (params?.memberId as string);
  const teamId = searchParams?.get('teamId') || undefined;

  // Always show tickets in view mode
  const shouldShowTickets = true;
  const shouldShowClockEvents = showClockEvents;

  const [memberData, setMemberData] = useState<API.MemberActivityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRange, setSelectedRange] = useState<DateRangeType>('day');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [customStartDate, setCustomStartDate] = useState<Date | null>(null);
  const [customEndDate, setCustomEndDate] = useState<Date | null>(null);

  useEffect(() => {
    const fetchMemberActivity = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await API.getMemberActivity(memberId, teamId);
        setMemberData(data);
      } catch (err) {
        console.error('Error fetching member activity:', err);
        setError('Failed to load member activity');
      } finally {
        setLoading(false);
      }
    };

    fetchMemberActivity();
  }, [memberId, teamId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="p-4 md:p-8">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
            <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !memberData) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="p-4 md:p-8">
          <Link
            href="/dashboard/teams"
            className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline mb-6"
            aria-label="Go back to teams page"
          >
            <ChevronLeft className="w-5 h-5" />
            <span>Back to Teams</span>
          </Link>
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-red-600 dark:text-red-400">{error || 'Failed to load member data'}</p>
          </div>
        </div>
      </div>
    );
  }

  const { member, timeTracking, recentTickets } = memberData;

  // Pulse count temporary disabled (set to 0)
  const pulseCount = 0;

  // Filter clock events based on selected time range
  const getFilteredClockEvents = () => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - 7);
    const startOfMonth = new Date(startOfToday);
    startOfMonth.setDate(startOfMonth.getDate() - 30);

    // For now, we're using today's events as the base
    // In a real implementation, you'd fetch data for the specific range
    const allEvents = timeTracking.today.clockEvents;
    
    // Since we only have today's data, we'll return it for today and empty for others
    // This should be updated when the API supports fetching historical data
    switch (selectedRange) {
      case 'day':
        // Check if selectedDate is today. Simple check.
        const isToday = selectedDate.getDate() === now.getDate() && 
                        selectedDate.getMonth() === now.getMonth() && 
                        selectedDate.getFullYear() === now.getFullYear();
        return isToday ? allEvents : []; // Show nothing for other dates for now
      case 'week':
      case 'month':
      case 'custom':
        // TODO: Fetch actual historical data from API
        return allEvents; // Placeholder - showing today's data for now
      default:
        return allEvents;
    }
  };

  const filteredClockEvents = getFilteredClockEvents();

  // Styles for timeline
  const timelineItemClass = "relative pl-6 py-3 border-l-2 border-slate-700 last:border-0";
  const getDotClass = (type: string) => `absolute -left-[5px] top-4 w-2.5 h-2.5 rounded-full ring-4 ring-slate-900 ${
    type === 'CLOCK_IN' ? 'bg-emerald-500' : 'bg-orange-500'
  }`;

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {/* Back Button - keeping style minimal to fit header area */}
      {showBackButton && (
        <Link
          href="/dashboard/teams"
          className="inline-flex items-center gap-2 text-blue-500 hover:text-blue-400 mb-2"
          aria-label="Go back to teams page"
        >
          <ChevronLeft className="w-5 h-5" />
          <span>Back to Teams</span>
        </Link>
      )}

      {/* Top Section: Profile Header Only */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl p-4 md:p-6 border border-gray-200 dark:border-gray-700 shadow-xl transition-colors">
        <div className="flex items-center gap-5">
          <div className="w-20 h-20 rounded-full bg-violet-600 flex items-center justify-center flex-shrink-0 text-2xl text-white font-medium">
            <User className="w-10 h-10" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{member.name}</h1>
            <p className="text-gray-500 dark:text-gray-400 mb-3">{member.email}</p>
            <div className="flex gap-3">
              <span className="px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300 text-sm font-medium border border-gray-200 dark:border-gray-700 flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${member.status === 'online' ? 'bg-green-500' : 'bg-slate-500'}`} />
                {member.status === 'online' ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Row: Today, Week, Pulses */}
      <div className="grid grid-cols-3 gap-2 md:gap-4">
        {/* Today's Time */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl md:rounded-3xl p-3 md:p-6 border border-gray-200 dark:border-gray-700 shadow-xl flex flex-col justify-center transition-colors">
             <div className="flex flex-col xl:flex-row xl:items-center gap-1.5 md:gap-3 mb-1 md:mb-2 text-center md:text-left">
                <div className="p-1.5 md:p-2 bg-blue-500/10 rounded-lg text-blue-500 w-fit mx-auto md:mx-0">
                   <Clock className="w-4 h-4 md:w-5 md:h-5" />
                </div>
                <span className="text-gray-500 dark:text-gray-400 text-xs md:text-sm">Today</span>
             </div>
             <span className="text-gray-900 dark:text-white font-bold text-lg md:text-2xl text-center md:text-left">{timeTracking.today.duration}</span>
          </div>

        {/* Week's Time */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl md:rounded-3xl p-3 md:p-6 border border-gray-200 dark:border-gray-700 shadow-xl flex flex-col justify-center transition-colors">
           <div className="flex flex-col xl:flex-row xl:items-center gap-1.5 md:gap-3 mb-1 md:mb-2 text-center md:text-left">
              <div className="p-1.5 md:p-2 bg-violet-500/10 rounded-lg text-violet-500 w-fit mx-auto md:mx-0">
                 <Calendar className="w-4 h-4 md:w-5 md:h-5" />
              </div>
              <span className="text-gray-500 dark:text-gray-400 text-xs md:text-sm">Week</span>
           </div>
           <span className="text-gray-900 dark:text-white font-bold text-lg md:text-2xl text-center md:text-left">{timeTracking.week.duration}</span>
        </div>

        {/* Pulses */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl md:rounded-3xl p-3 md:p-6 border border-gray-200 dark:border-gray-700 shadow-xl flex flex-col justify-center transition-colors">
           <div className="flex flex-col xl:flex-row xl:items-center gap-1.5 md:gap-3 mb-1 md:mb-2 text-center md:text-left">
              <div className="p-1.5 md:p-2 bg-emerald-500/10 rounded-lg text-emerald-500 w-fit mx-auto md:mx-0">
                 <svg className="w-4 h-4 md:w-5 md:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                 </svg>
              </div>
              <span className="text-gray-500 dark:text-gray-400 text-xs md:text-sm">Pulses</span>
           </div>
           <p className="text-gray-900 dark:text-white font-bold text-lg md:text-2xl text-center md:text-left">{pulseCount}</p>
        </div>
      </div>

      {/* Main Content: Recent Tickets & Clock Events */}
      <div className={`grid grid-cols-1 ${shouldShowClockEvents ? 'lg:grid-cols-2' : ''} gap-6`}>
        {/* Left Column: Recent Tickets */}
        {shouldShowTickets && (
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 border border-gray-200 dark:border-gray-700 shadow-xl transition-colors h-fit">
           <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                 <div className="p-2 bg-amber-500/10 rounded-lg text-amber-500">
                    <Briefcase className="w-5 h-5" />
                 </div>
                 <h2 className="text-xl font-bold text-gray-900 dark:text-white">Recent Tickets</h2>
              </div>
              {recentTickets.length > 0 && (
                <Link href="/dashboard/tickets" className="text-sm text-blue-500 hover:text-blue-400">
                  View All
                </Link>
              )}
           </div>
           
           <div className="space-y-3">
             {recentTickets.length > 0 ? (
               recentTickets.map((rawTicket, index) => {
                 const ticket = enhanceTicketData(rawTicket);
                 return (
                 <div 
                   key={ticket.id || index}
                   className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-xl border border-gray-100 dark:border-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700/60 transition-colors group"
                 >
                   <div className="flex justify-between items-start mb-2">
                      <Link href={`/dashboard/tickets/${ticket.id}`} className="font-medium text-gray-900 dark:text-white hover:text-blue-500 text-base line-clamp-1 flex-1 mr-3">
                         {ticket.title}
                      </Link>
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 whitespace-nowrap">
                         {ticket.status || 'In Progress'}
                      </span>
                   </div>
                   
                   <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-3">
                      <div className="flex items-center gap-1.5">
                         <Clock className="w-3.5 h-3.5" />
                         <span>{ticket.timeSpent}</span>
                      </div>
                   </div>

                   {/* References Section */}
                   {ticket.references && ticket.references.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                         {ticket.references.map((ref: any, i: number) => (
                            <a 
                               key={i} 
                               href={ref.url}
                               onClick={(e) => e.stopPropagation()}
                               className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-white dark:bg-gray-800 text-xs text-blue-600 dark:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-600 shadow-sm"
                            >
                               {ref.type === 'github' ? <ExternalLink className="w-3 h-3" /> : <LinkIcon className="w-3 h-3" />}
                               {ref.label}
                            </a>
                         ))}
                      </div>
                   )}
                 </div>
               )})
             ) : (
                <div className="text-center py-8 text-gray-400 dark:text-gray-500">
                  <Briefcase className="w-12 h-12 mx-auto mb-2 opacity-20" />
                  <p>No recent activity found</p>
                </div>
             )}
           </div>
        </div>
        )}

        {/* Right Column: Clock Events Timeline */}
        {shouldShowClockEvents && (
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 border border-gray-200 dark:border-gray-700 shadow-xl transition-colors h-fit">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
             <div className="flex items-center gap-3">
                 <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500">
                    <Clock className="w-5 h-5" />
                 </div>
                 <h2 className="text-xl font-bold text-gray-900 dark:text-white">Activity Feed</h2>
             </div>
             <SlidingDateFilter 
               selectedDate={selectedDate}
               onDateSelect={setSelectedDate}
               selectedRange={selectedRange}
               onRangeSelect={setSelectedRange}
               customStartDate={customStartDate}
               customEndDate={customEndDate}
               onCustomRangeChange={(start, end) => {
                 setCustomStartDate(start);
                 setCustomEndDate(end);
               }}
               className="w-full sm:max-w-xl"
             />
          </div>

          <div className="space-y-1 pl-2">
            {filteredClockEvents.length > 0 ? (
              filteredClockEvents.map((event, index) => (
                <div key={index} className="relative pl-8 pb-8 border-l border-gray-200 dark:border-gray-700 last:border-0 last:pb-0">
                  <div className={getDotClass(event.type)} />
                  <div className="bg-gray-50/50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700 flex justify-between items-center group hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors">
                     <div className="flex items-center gap-3">
                        <span className={`font-medium ${event.type === 'CLOCK_IN' ? 'text-emerald-600 dark:text-emerald-400' : 'text-orange-600 dark:text-orange-400'}`}>
                           {event.type === 'CLOCK_IN' ? 'Clocked In' : 'Clocked Out'}
                        </span>
                     </div>
                     <div className="flex items-center gap-4">
                        <span className="text-gray-500 dark:text-gray-400 font-mono">{event.time}</span>
                     </div>
                  </div>
                </div>
              ))
            ) : (
               <div className="text-center py-8 text-gray-400 dark:text-gray-500">
                  <div className="w-2.5 h-2.5 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto mb-4" />
                  <p>No clock events recorded for this period</p>
               </div>
            )}
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
