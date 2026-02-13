'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Clock, User, Calendar, Loader2, Github, Linkedin, ChevronDown, Zap } from 'lucide-react';
import * as API from '@/TimeharborAPI/dashboard';
import * as TeamAPI from '@/TimeharborAPI/teams';
import { useRouter } from 'next/navigation';
import { ActivitySession } from './types';
import { SessionCard } from './components/SessionCard';
import TimeRangeFilter, { TimeRange } from '@/components/TimeRangeFilter';

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
  const [timeRange, setTimeRange] = useState<TimeRange>('today');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [teamMembers, setTeamMembers] = useState<TeamAPI.Member[]>([]);

  const filteredSessions = sessions.filter(session => {
    const sessionDate = new Date(session.startTime);
    const now = new Date();
    // Normalize dates to start of day for comparison
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (timeRange) {
      case 'today':
        return sessionDate >= startOfToday;
      case 'yesterday': {
        const startOfYesterday = new Date(startOfToday);
        startOfYesterday.setDate(startOfYesterday.getDate() - 1);
        const endOfYesterday = new Date(startOfToday);
        return sessionDate >= startOfYesterday && sessionDate < endOfYesterday;
      }
      case 'week': {
        const startOfWeek = new Date(startOfToday);
        startOfWeek.setDate(startOfWeek.getDate() - 7);
        return sessionDate >= startOfWeek;
      }
      case 'month': {
        const startOfMonth = new Date(startOfToday);
        startOfMonth.setDate(startOfMonth.getDate() - 30);
        return sessionDate >= startOfMonth;
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
            <Link
            href="/dashboard/teams"
            className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline"
            >
            <ChevronLeft className="w-5 h-5" />
            <span>Back to Teams</span>
            </Link>
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

  const { member: apiMember, timeTracking, recentTickets } = memberData;

  // TEMPORARY: Inject dummy social links so you can see the UI layout
  const member = {
    ...apiMember,
    github: apiMember.github || 'https://github.com',
    linkedin: apiMember.linkedin || 'https://linkedin.com'
  };

  // Pulse count temporary disabled (set to 0)
  const pulseCount = 0;

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
          <div className="flex-1 min-w-0">
            <div className="relative group w-fit">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1 flex items-center gap-2 cursor-pointer">
                  {member.name}
                  <ChevronDown className="w-5 h-5 text-gray-400 group-hover:text-gray-600 transition-colors" />
                </h1>
                {teamMembers.length > 0 && (
                    <select 
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        value={member.id}
                        onChange={(e) => {
                            const newId = e.target.value;
                            if (newId !== member.id) {
                                const url = `/dashboard/member?id=${newId}${teamId ? `&teamId=${teamId}` : ''}`;
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
            
            <p className="text-gray-500 dark:text-gray-400 mb-3 truncate">{member.email}</p>
            
            <div className="flex flex-wrap items-center gap-3">
              <span className="px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300 text-sm font-medium border border-gray-200 dark:border-gray-700 flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${member.status === 'online' ? 'bg-green-500' : 'bg-slate-500'}`} />
                {member.status === 'online' ? 'Online' : 'Offline'}
              </span>

              {/* Pulse Count & Social Links */}
              <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-full border border-amber-100 dark:border-amber-800/30" title="Pulse Points">
                     <Zap className="w-3.5 h-3.5 fill-current" />
                     <span className="text-sm font-bold">{pulseCount}</span>
                  </div>

                  {(member.github || member.linkedin) && (
                    <>
                       <div className="h-4 w-px bg-gray-300 dark:bg-gray-600 mx-1 hidden sm:block"></div>
                       {member.github && (
                        <a 
                          href={member.github}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors border border-gray-100 dark:border-gray-700"
                          aria-label="GitHub Profile"
                        >
                          <Github className="w-4 h-4" />
                        </a>
                      )}
                      {member.linkedin && (
                        <a 
                          href={member.linkedin}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 bg-gray-50 dark:bg-gray-700/50 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-colors border border-gray-100 dark:border-gray-700"
                          aria-label="LinkedIn Profile"
                        >
                          <Linkedin className="w-4 h-4" />
                        </a>
                      )}
                    </>
                  )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Row: Today, Week (Compact) */}
      <div className={`grid ${timeRange === 'custom' ? 'grid-cols-3' : 'grid-cols-2'} gap-2 md:gap-4 mb-2`}>
        {/* Today's Time */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-2 md:p-3 border border-gray-200 dark:border-gray-700 shadow-sm flex items-center gap-2 md:gap-3 transition-colors">
             <div className="p-1.5 md:p-2 bg-blue-500/10 rounded-lg text-blue-500 flex-shrink-0">
                <Clock className="w-4 h-4 md:w-5 md:h-5" />
             </div>
             <div className="min-w-0">
                <p className="text-[10px] md:text-xs text-gray-500 dark:text-gray-400 font-medium truncate">Today</p>
                <p className="text-gray-900 dark:text-white font-bold text-sm md:text-lg leading-tight truncate">{timeTracking.today.duration}</p>
             </div>
          </div>

        {/* Week's Time */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-2 md:p-3 border border-gray-200 dark:border-gray-700 shadow-sm flex items-center gap-2 md:gap-3 transition-colors">
             <div className="p-1.5 md:p-2 bg-violet-500/10 rounded-lg text-violet-500 flex-shrink-0">
                <Calendar className="w-4 h-4 md:w-5 md:h-5" />
             </div>
             <div className="min-w-0">
                <p className="text-[10px] md:text-xs text-gray-500 dark:text-gray-400 font-medium truncate">Week</p>
                <p className="text-gray-900 dark:text-white font-bold text-sm md:text-lg leading-tight truncate">{timeTracking.week.duration}</p>
             </div>
          </div>

        {/* Custom Range Time */}
        {timeRange === 'custom' && (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-2 md:p-3 border border-gray-200 dark:border-gray-700 shadow-sm flex items-center gap-2 md:gap-3 transition-colors animate-in fade-in zoom-in-95 duration-200">
             <div className="p-1.5 md:p-2 bg-emerald-500/10 rounded-lg text-emerald-500 flex-shrink-0">
                <Calendar className="w-4 h-4 md:w-5 md:h-5" />
             </div>
             <div className="min-w-0">
                <p className="text-[10px] md:text-xs text-gray-500 dark:text-gray-400 font-medium truncate">Range</p>
                <p className="text-gray-900 dark:text-white font-bold text-sm md:text-lg leading-tight truncate">{calculateTotalDuration(filteredSessions)}</p>
             </div>
          </div>
        )}
      </div>

      {/* Main Content: Unified Activity Timeline */}
      <div className="space-y-4">
         <div className="flex flex-row items-center justify-between gap-4 mb-2 px-2">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
               Activity Feed
            </h2>
            <TimeRangeFilter 
              selected={timeRange} 
              onChange={setTimeRange} 
              startDate={customStartDate}
              endDate={customEndDate}
              onDateChange={(start, end) => {
                setCustomStartDate(start);
                setCustomEndDate(end);
              }}
            />
         </div>

         <div className="space-y-4">
           {filteredSessions.length > 0 ? (
             filteredSessions.map((session) => (
               <SessionCard key={session.id} session={session} />
             ))
           ) : (
              <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-3xl border border-gray-200 dark:border-gray-700">
                 <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full mx-auto mb-4 flex items-center justify-center text-gray-400">
                    <Clock className="w-6 h-6" />
                 </div>
                 <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">No activity yet</h3>
                 <p className="text-gray-500 dark:text-gray-400">Activity will appear here when working</p>
              </div>
           )}
         </div>

         {hasMore && (
            <div className="flex justify-center pt-4 pb-8">
                <button
                    onClick={handleShowMore}
                    disabled={loadingMore}
                    className="px-6 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition flex items-center gap-2 shadow-sm"
                >
                    {loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Show More'}
                </button>
            </div>
         )}
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
