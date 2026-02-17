'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Clock, User, Calendar, Loader2, Github, Linkedin, ChevronDown } from 'lucide-react';
import * as API from '@/TimeharborAPI/dashboard';
import * as TeamAPI from '@/TimeharborAPI/teams';
import { useRouter } from 'next/navigation';
import { ActivitySession } from './types';
import { SessionCard } from './components/SessionCard';
import { SlidingDateFilter } from '@/components/SlidingDateFilter';

interface MemberPageProps {
  memberId?: string;
  showClockEvents?: boolean; // @deprecated
  mode?: 'view'; // 'profile' mode removed, use dashboard/settings/profile/page.tsx instead
  showBackButton?: boolean;
}

function MemberPageContent({ 
  memberId: propMemberId, 
  showClockEvents = true, 
  showBackButton = true 
}: MemberPageProps = {}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  // We now use query param 'id' instead of dynamic route param
  const memberId = propMemberId || searchParams?.get('id');
  const teamId = searchParams?.get('teamId') || undefined;

  // Always show tickets in view mode
  const shouldShowTickets = true;
  const shouldShowClockEvents = showClockEvents;

  const [memberData, setMemberData] = useState<API.MemberActivityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination State
  const [sessions, setSessions] = useState<ActivitySession[]>([]);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [timeRange, setTimeRange] = useState<string>(() => {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    return new Date(now.getTime() - (offset * 60 * 1000)).toISOString().split('T')[0];
  });
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [teamMembers, setTeamMembers] = useState<TeamAPI.Member[]>([]);

  const filteredSessions = sessions.filter(session => {
    const sessionDate = new Date(session.startTime);
    const now = new Date();
    // Normalize dates to start of day for comparison
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Check if timeRange is a date string (YYYY-MM-DD)
    if (/^\d{4}-\d{2}-\d{2}$/.test(timeRange)) {
        const [y, m, d] = timeRange.split('-').map(Number);
        const targetDate = new Date(y, m - 1, d);
        const nextDay = new Date(targetDate);
        nextDay.setDate(nextDay.getDate() + 1);
        return sessionDate >= targetDate && sessionDate < nextDay;
    }

    switch (timeRange) {
      case 'today':
        return sessionDate >= startOfToday;
      case 'last_week': {
        const startOfWeek = new Date(startOfToday);
        startOfWeek.setDate(startOfWeek.getDate() - 7);
        return sessionDate >= startOfWeek;
      }
      case 'last_month': {
        const startOfMonth = new Date(startOfToday);
        startOfMonth.setDate(startOfMonth.getDate() - 30);
        return sessionDate >= startOfMonth;
      }
      case 'this_month': {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        return sessionDate >= startOfMonth;
      }
      case 'this_week': {
        const startOfWeek = new Date(startOfToday);
        // Assuming week starts on Sunday. Adjust if needed (e.g. Monday)
        startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay());
        return sessionDate >= startOfWeek;
      }
      case 'custom': {
        if (!customStartDate) return true;
        
        // Parse "YYYY-MM-DD" as local date
        const [sYear, sMonth, sDay] = customStartDate.split('-').map(Number);
        const startDate = new Date(sYear, sMonth - 1, sDay);
        
        if (sessionDate < startDate) return false;

        if (customEndDate) {
            const [eYear, eMonth, eDay] = customEndDate.split('-').map(Number);
            const endDate = new Date(eYear, eMonth - 1, eDay);
            // Add 1 day to include the end date fully (up to 23:59:59)
            endDate.setDate(endDate.getDate() + 1); 
            if (sessionDate >= endDate) return false;
        }
        return true;
      }
      default:
        return true;
    }
  });

  const calculateTotalDuration = (sessionsToSum: ActivitySession[]) => {
    let totalMs = 0;
    const now = Date.now();
    
    sessionsToSum.forEach(session => {
        const start = new Date(session.startTime).getTime();
        const end = session.endTime ? new Date(session.endTime).getTime() : now;
        totalMs += (end - start);
    });
    
    const hours = Math.floor(totalMs / 3600000);
    const minutes = Math.floor((totalMs % 3600000) / 60000);
    
    return `${hours}h ${minutes}m`;
  };

  const mapSessionFromApi = (s: any): ActivitySession => ({
        id: s.id,
        startTime: new Date(s.startTime),
        endTime: s.endTime ? new Date(s.endTime) : undefined,
        status: s.status,
        events: s.events
            .filter((e: any) => {
                if (!shouldShowClockEvents && e.type === 'CLOCK') return false;
                return true;
            })
            .map((e: any) => ({
                ...e,
                timestamp: new Date(e.timestamp),
                original: e.original || {},
                timeFormatted: e.timeFormatted || new Date(e.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})
            }))
  });

  useEffect(() => {
    if (!memberId) return;

    const fetchMemberActivity = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await API.getMemberActivity(memberId, teamId, undefined, 5);
        setMemberData(data);
        
        if (data.sessions) {
            const mappedSessions = data.sessions.map(mapSessionFromApi);
            setSessions(mappedSessions);
            if (data.sessions.length >= 5) {
                setHasMore(true);
                setNextCursor(data.sessions[data.sessions.length - 1].startTime);
            } else {
                setHasMore(false);
            }
        }
      } catch (err) {
        console.error('Error fetching member activity:', err);
        setError('Failed to load member activity');
      } finally {
        setLoading(false);
      }
    };

    fetchMemberActivity();
  }, [memberId, teamId]);

  useEffect(() => {
    const loadTeamMembers = async () => {
      try {
        const teams = await TeamAPI.fetchMyTeams();
        let targetTeam: TeamAPI.Team | undefined;
        
        if (teamId) {
            targetTeam = teams.find(t => t.id === teamId);
        } else if (memberId) {
             targetTeam = teams.find(t => t.members.some(m => m.id === memberId));
        }
        
        if (!targetTeam && teams.length > 0) targetTeam = teams[0];

        if (targetTeam) {
            setTeamMembers(targetTeam.members);
        }
      } catch (err) {
        console.error("Failed to load team members", err);
      }
    };
    loadTeamMembers();
  }, [teamId, memberId]);

  const handleShowMore = async () => {
      if (!nextCursor || loadingMore || !memberId) return;
      
      setLoadingMore(true);
      try {
           const data = await API.getMemberActivity(memberId, teamId, nextCursor, 5);
           if (data.sessions && data.sessions.length > 0) {
               const newSessions = data.sessions.map(mapSessionFromApi);
               setSessions(prev => [...prev, ...newSessions]);
               
               if (data.sessions.length >= 5) {
                   setHasMore(true);
                   setNextCursor(data.sessions[data.sessions.length - 1].startTime);
               } else {
                   setHasMore(false);
               }
           } else {
               setHasMore(false);
           }
      } catch (err) {
          console.error("Error loading more sessions", err);
      } finally {
          setLoadingMore(false);
      }
  };

  if (!memberId) {
     return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="p-8 text-center">
            <p className="text-gray-500 mb-4">No member specified</p>
        </div>
      </div>
     );
  }

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
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-red-600 dark:text-red-400">{error || 'Failed to load member data'}</p>
          </div>
        </div>
      </div>
    );
  }

  const { member: apiMember, timeTracking, recentTickets } = memberData;

  // TEMPORARY: Inject dummy social links so you can see the UI layout
  const member = {
    ...apiMember,
    github: apiMember.github || 'https://github.com',
    linkedin: apiMember.linkedin || 'https://linkedin.com'
  };

  return (
    <div className="-mx-4 -mt-4 md:-mx-8 md:-mt-8 min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Profile Header */}
      <div className="bg-white dark:bg-[#0B1120] px-4 py-6 md:px-8 md:py-8 pb-12 md:pb-16 border-b border-gray-100 dark:border-gray-800 transition-colors duration-200 flex-shrink-0">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between gap-4">
            
            {/* Left Side: Profile */}
            <div className="flex items-center gap-4 md:gap-5 flex-1 min-w-0">
                <div className="w-20 h-20 rounded-[1.5rem] bg-violet-600 flex items-center justify-center flex-shrink-0 text-2xl text-white font-medium shadow-lg shadow-violet-900/20">
                  <User className="w-9 h-9" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="relative group w-fit">
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white leading-tight flex items-center gap-2 cursor-pointer">
                      {member.name}
                      <ChevronDown className="w-6 h-6 text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" />
                    </h1>
                     {teamMembers.length > 0 && (
                        <select 
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            value={member.id}
                            onChange={(e) => {
                                const newId = e.target.value;
                                if (newId !== member.id) {
                                    const selectedMember = teamMembers.find(m => m.id === newId);
                                    const url = `/dashboard/member?id=${newId}${teamId ? `&teamId=${teamId}` : ''}${selectedMember ? `&name=${encodeURIComponent(selectedMember.name)}` : ''}`;
                                    router.push(url);
                                }
                            }}
                        >
                            {teamMembers.map((m) => (
                                <option key={m.id} value={m.id}>
                                    {m.name}
                                </option>
                            ))}
                        </select>
                    )}
                  </div>
                  
                  <p className="text-gray-500 dark:text-gray-400 text-base md:text-lg truncate font-medium">{member.email}</p>
                  
                  <div className="flex flex-wrap items-center gap-3 mt-1.5">
                    <span className={`text-sm font-medium ${member.status === 'online' ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                      {member.status === 'online' ? 'Online' : 'Offline'}
                    </span>
                    
                     {(member.github || member.linkedin) && (
                        <div className="flex items-center gap-4 border-l border-gray-200 dark:border-gray-700 pl-3 ml-1">
                           {member.github && (
                            <a 
                              href={member.github}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                              aria-label="GitHub Profile"
                            >
                              <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                              </svg>
                            </a>
                          )}
                          {member.linkedin && (
                            <a 
                              href={member.linkedin}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#0077b5] hover:opacity-80 transition-opacity"
                              aria-label="LinkedIn Profile"
                            >
                              <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                                <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                              </svg>
                            </a>
                          )}
                        </div>
                      )}
                  </div>
                </div>
            </div>

            {/* Right Side: Options Menu */}
             <div className="hidden md:flex items-center justify-center w-12 h-12 rounded-full border border-gray-200 dark:border-white/10 text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-colors cursor-pointer flex-shrink-0">
                <span className="sr-only">More options</span>
                <div className="flex gap-0.5">
                    <div className="w-1 h-1 rounded-full bg-current"></div>
                    <div className="w-1 h-1 rounded-full bg-current"></div>
                    <div className="w-1 h-1 rounded-full bg-current"></div>
                </div>
             </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl w-full mx-auto px-4 md:px-0 -mt-6 md:-mt-8 relative z-10 pb-8">
        {/* Stats Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-3 shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-700 flex-shrink-0 mb-4">
            {(() => {
                const getRangeConfig = () => {
                    if (timeRange === 'custom') return { show: true, label: 'Custom Range' };
                    if (timeRange === 'last_week') return { show: true, label: 'Last Week' };
                    if (timeRange === 'this_week') return { show: true, label: 'This Week' };
                    if (timeRange === 'last_month') return { show: true, label: 'Last Month' };
                    if (timeRange === 'this_month') return { show: true, label: 'This Month' };
                    
                    // Check for YYYY-MM-DD date string
                    if (/^\d{4}-\d{2}-\d{2}$/.test(timeRange)) {
                        const now = new Date();
                        const offset = now.getTimezoneOffset();
                        const localToday = new Date(now.getTime() - (offset * 60 * 1000)).toISOString().split('T')[0];
                        const utcToday = now.toISOString().split('T')[0];
                        
                        // Hide if today (redundant with first card)
                        if (timeRange === 'today' || timeRange === localToday || timeRange === utcToday) {
                            return { show: false, label: '' };
                        }
                        
                        const [y, m, d] = timeRange.split('-').map(Number);
                        const date = new Date(y, m - 1, d);
                        return { 
                            show: true, 
                            label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                        };
                    }
                    return { show: false, label: '' };
                };

                const { show, label } = getRangeConfig();

                return (
                    <div className={`grid ${show ? 'grid-cols-3' : 'grid-cols-2'} gap-2 divide-x divide-gray-100 dark:divide-gray-700`}>
                        <div className="text-center px-2 pt-0.5">
                            <div className="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-0.5 flex items-center justify-center gap-1.5">
                                <Clock className="w-3 h-3" />
                                Today
                            </div>
                            <div className="text-xl font-bold text-gray-900 dark:text-white">{timeTracking.today.duration}</div>
                        </div>
                        <div className="text-center px-2 pt-0.5">
                            <div className="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-0.5 flex items-center justify-center gap-1.5">
                                <Calendar className="w-3 h-3" />
                                This Week
                            </div>
                            <div className="text-xl font-bold text-gray-900 dark:text-white">{timeTracking.week.duration}</div>
                        </div>
                        {show && (
                            <div className="text-center px-2 pt-0.5 animate-in fade-in zoom-in-95 duration-200">
                                <div className="text-blue-600 dark:text-blue-400 text-[10px] font-bold uppercase tracking-wider mb-0.5 flex items-center justify-center gap-1.5">
                                    <Calendar className="w-3 h-3" />
                                    {label}
                                </div>
                                <div className="text-xl font-bold text-gray-900 dark:text-white">{calculateTotalDuration(filteredSessions)}</div>
                            </div>
                        )}
                    </div>
                );
            })()}
        </div>

       {/* Main Content: Unified Activity Timeline */}
       <div>
         <div className="mb-4">
            <SlidingDateFilter selected={timeRange} onSelect={setTimeRange} />
            
            {timeRange === 'custom' && (
                <div className="mt-4 flex flex-wrap items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">From:</span>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">To:</span>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
            )}
         </div>

         <div>
           {filteredSessions.length > 0 ? (
             <div>
               {filteredSessions.map((session) => (
                 <SessionCard key={session.id} session={session} member={member} />
               ))}
               
               {hasMore && (
                  <div className="flex justify-center py-8">
                      <button
                          onClick={handleShowMore}
                          disabled={loadingMore}
                          className="px-8 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition flex items-center gap-2 shadow-sm"
                      >
                          {loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Show More'}
                      </button>
                  </div>
               )}
             </div>
           ) : (
              <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-3xl border border-dashed border-gray-200 dark:border-gray-700">
                 <div className="w-16 h-16 bg-gray-50 dark:bg-gray-700/50 rounded-full mx-auto mb-4 flex items-center justify-center text-gray-400">
                    <Clock className="w-8 h-8 opacity-50" />
                 </div>
                 <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">No activity yet</h3>
                 <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
                    Activity sessions will appear here once {member.name.split(' ')[0]} starts tracking time.
                 </p>
              </div>
           )}
         </div>
      </div>
    </div>
    </div>
  );
}

export default function MemberPageClient(props: MemberPageProps) {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="p-4 md:p-8">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
          </div>
        </div>
      </div>
    }>
      <MemberPageContent {...props} />
    </Suspense>
  );
}
