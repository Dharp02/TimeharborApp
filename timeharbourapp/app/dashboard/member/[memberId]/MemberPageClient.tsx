'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, ChevronDown, Clock, User, Briefcase, Calendar, ExternalLink, Link as LinkIcon } from 'lucide-react';
import * as API from '@/TimeharborAPI/dashboard';

// Helper function to enhance ticket data with defaults for missing fields
const enhanceTicketData = (rawTicket: any) => {
  const dateStr = rawTicket.lastWorkedOn;
  let formattedDate = 'Recently';
  
  if (dateStr) {
    try {
      formattedDate = new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
      });
    } catch (e) {
      formattedDate = dateStr;
    }
  }

  return {
    ...rawTicket,
    status: rawTicket.status || 'In Progress',
    timeSpent: formattedDate,
    references: rawTicket.references || []
  };
};

export default function MemberPageClient() {
  const params = useParams();
  const searchParams = useSearchParams();
  const memberId = params.memberId as string;
  const teamId = searchParams.get('teamId') || undefined;

  const [memberData, setMemberData] = useState<API.MemberActivityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTicketsOpen, setIsTicketsOpen] = useState(false);

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

  // Static pulse count for demo
  const pulseCount = 12;

  // Styles for timeline
  const timelineItemClass = "relative pl-6 py-3 border-l-2 border-slate-700 last:border-0";
  const getDotClass = (type: string) => `absolute -left-[5px] top-4 w-2.5 h-2.5 rounded-full ring-4 ring-slate-900 ${
    type === 'CLOCK_IN' ? 'bg-emerald-500' : 'bg-orange-500'
  }`;

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {/* Back Button - keeping style minimal to fit header area */}
      <Link
        href="/dashboard/teams"
        className="inline-flex items-center gap-2 text-blue-500 hover:text-blue-400 mb-2"
        aria-label="Go back to teams page"
      >
        <ChevronLeft className="w-5 h-5" />
        <span>Back to Teams</span>
      </Link>

      {/* Top Section: Profile Header Only */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 border border-gray-200 dark:border-gray-700 shadow-xl transition-colors">
        <div className="flex items-center gap-5">
          <div className="w-20 h-20 rounded-full bg-violet-600 flex items-center justify-center flex-shrink-0 text-2xl text-white font-medium">
            <User className="w-10 h-10" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{member.name}</h1>
            <p className="text-gray-500 dark:text-gray-400 mb-3">{member.email}</p>
            <div className="flex gap-3">
              <span className="px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300 text-sm font-medium border border-gray-200 dark:border-gray-700">
                {member.role}
              </span>
              <span className="px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300 text-sm font-medium border border-gray-200 dark:border-gray-700 flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${member.status === 'online' ? 'bg-green-500' : 'bg-slate-500'}`} />
                {member.status === 'online' ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Row: Today, Week, Recent Tickets, Pulses */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Time */}
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-4 md:p-6 border border-gray-200 dark:border-gray-700 shadow-xl flex flex-col justify-center transition-colors">
           <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500">
                 <Clock className="w-5 h-5" />
              </div>
              <span className="text-gray-500 dark:text-gray-400 text-sm">Today</span>
           </div>
           <span className="text-gray-900 dark:text-white font-bold text-xl md:text-2xl">{timeTracking.today.duration}</span>
        </div>

        {/* Week's Time */}
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-4 md:p-6 border border-gray-200 dark:border-gray-700 shadow-xl flex flex-col justify-center transition-colors">
           <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-violet-500/10 rounded-lg text-violet-500">
                 <Calendar className="w-5 h-5" />
              </div>
              <span className="text-gray-500 dark:text-gray-400 text-sm">Week</span>
           </div>
           <span className="text-gray-900 dark:text-white font-bold text-xl md:text-2xl">{timeTracking.week.duration}</span>
        </div>

        {/* Recent Tickets - Condensed with Dropdown */}
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-4 md:p-6 border border-gray-200 dark:border-gray-700 shadow-xl flex flex-col justify-center relative transition-colors">
           <button 
             onClick={() => setIsTicketsOpen(!isTicketsOpen)}
             className="w-full text-left"
           >
             <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-500/10 rounded-lg text-amber-500">
                       <Briefcase className="w-5 h-5" />
                    </div>
                    <span className="text-gray-500 dark:text-gray-400 text-sm">Recent Tickets</span>
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isTicketsOpen ? 'rotate-180' : ''}`} />
             </div>
             
             {recentTickets.length > 0 ? (
                <div className="text-gray-900 dark:text-white font-bold text-lg hover:text-blue-500 truncate block w-full">
                   {recentTickets[0].title}
                </div>
             ) : (
                <p className="text-gray-400 dark:text-gray-500 font-bold">No active tickets</p>
             )}
           </button>

           {/* Dropdown Menu */}
           {isTicketsOpen && recentTickets.length > 0 && (
             <div className="absolute top-full left-0 mt-4 w-[350px] md:w-[450px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl z-50 overflow-hidden ring-1 ring-black/5 dark:ring-white/5">
               <div className="bg-gray-50/50 dark:bg-gray-900/50 px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Active Tasks</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded-full">{recentTickets.length} items</span>
               </div>
               <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                 {recentTickets.map((rawTicket, index) => {
                   const ticket = enhanceTicketData(rawTicket);
                   return (
                   <div 
                     key={ticket.id || index}
                     className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 border-b border-gray-200/50 dark:border-gray-700/50 last:border-0 transition-colors group"
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
                                 className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-900 text-xs text-blue-600 dark:text-blue-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-700"
                              >
                                 {ref.type === 'github' ? <ExternalLink className="w-3 h-3" /> : <LinkIcon className="w-3 h-3" />}
                                 {ref.label}
                              </a>
                           ))}
                        </div>
                     )}
                   </div>
                 )})}
               </div>
               <div className="bg-gray-50/30 dark:bg-gray-900/30 px-4 py-2 border-t border-gray-200 dark:border-gray-700 text-center">
                  <Link href={`/dashboard/tickets`} className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                     View all tickets
                  </Link>
               </div>
             </div>
           )}
        </div>

        {/* Pulses */}
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-4 md:p-6 border border-gray-200 dark:border-gray-700 shadow-xl flex flex-col justify-center transition-colors">
           <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500">
                 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                 </svg>
              </div>
              <span className="text-gray-500 dark:text-gray-400 text-sm">Pulses</span>
           </div>
           <p className="text-gray-900 dark:text-white font-bold text-xl md:text-2xl">{pulseCount} <span className="text-sm font-normal text-gray-400 dark:text-gray-500">today</span></p>
        </div>
      </div>

      {/* Bottom Section: Clock Events Timeline */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 border border-gray-200 dark:border-gray-700 shadow-xl transition-colors">
        <div className="flex justify-between items-center mb-6">
           <h2 className="text-xl font-bold text-gray-900 dark:text-white">Clock Events</h2>
           <span className="text-gray-500 dark:text-gray-400 text-sm">Today</span>
        </div>

        <div className="space-y-1 pl-2">
          {timeTracking.today.clockEvents.length > 0 ? (
            timeTracking.today.clockEvents.map((event, index) => (
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
             <p className="text-gray-400 dark:text-gray-500 text-center py-6">No clock events recorded today</p>
          )}
        </div>
      </div>
    </div>
  );
}
