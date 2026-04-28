import { db } from '../db';
import { computeSession } from '@timeharbor/time-engine';
import { formatDurationMs } from '../../lib/formatDuration';

export interface DashboardStats {
  totalHoursToday: string;
  totalHoursWeek: string;
  totalMsToday?: number;
  totalMsWeek?: number;
  openTickets: number;
  teamMembers: number;
}

export interface Activity {
  id: string;
  teamId?: string;
  userId?: string;
  type: string;
  title: string;
  subtitle?: string;
  description?: string;
  link?: string;
  startTime: string;
  endTime?: string;
  status?: 'Active' | 'Completed' | 'Pending' | 'Failed';
  duration?: string;
  durationMs?: number;
  metadata?: Record<string, any>;
}

function getWeekStartDate(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
  const monday = new Date(now);
  monday.setDate(diff);
  return monday.toISOString().slice(0, 10);
}

export const getStats = async (_teamId?: string): Promise<DashboardStats> => {
  const now = Date.now();
  const todayStr = new Date().toISOString().slice(0, 10);
  const weekStartStr = getWeekStartDate();

  const allSessions = await db.workSessions.toArray();

  let todayMs = 0;
  let weekMs = 0;

  for (const s of allSessions) {
    // For open sessions, recompute with current time
    const netMs = s.clockOut === null
      ? computeSession({ clockIn: s.clockIn, clockOut: null, ticketSegments: s.ticketSegments, breaks: s.breaks }, now).netWorkMs
      : s.netWorkMs;

    if (s.date === todayStr) todayMs += netMs;
    if (s.date >= weekStartStr) weekMs += netMs;
  }

  const openTickets = await db.tickets.filter(t => t.status !== 'Closed' && t.status !== 'Done').count();

  return {
    totalHoursToday: formatDurationMs(todayMs),
    totalHoursWeek: formatDurationMs(weekMs),
    totalMsToday: todayMs,
    totalMsWeek: weekMs,
    openTickets,
    teamMembers: 0,
  };
};

export const getActivity = async (_teamId?: string, _limit?: number | 'all'): Promise<Activity[]> => {
  const logs = await db.activityLogs.toArray();
  return logs;
};

export interface MemberProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  github_url?: string;
  linkedin_url?: string;
  redmine_url?: string;
}

export interface ClockEvent {
  type: 'CLOCK_IN' | 'CLOCK_OUT';
  timestamp: string;
  time: string;
}

export interface MemberActivityData {
  member: MemberProfile;
  timeTracking: {
    today: {
      duration: string;
      totalMs: number;
      clockEvents: ClockEvent[];
    };
    week: {
      duration: string;
      totalMs: number;
    };
    month: {
      duration: string;
      totalMs: number;
    };
  };
  recentTickets: Array<{
    id: string;
    title: string;
    lastWorkedOn: string;
  }>;
  sessions?: Array<{
    id: string;
    startTime: string;
    endTime?: string | null;
    status: 'active' | 'completed' | 'adhoc';
    durationMs: number;
    events: Array<{
      id: string;
      type: string;
      title: string;
      timestamp: string;
      original: any;
      timeFormatted: string;
    }>;
  }>;
}

export const getMemberActivity = async (_memberId: string, _teamId?: string, _cursor?: string, _limit: number = 5): Promise<MemberActivityData> => {
  return { member: {} as any, timeTracking: { today: { duration: '0h 0m', totalMs: 0, clockEvents: [] }, week: { duration: '0h 0m', totalMs: 0 }, month: { duration: '0h 0m', totalMs: 0 } }, recentTickets: [] };
};

export interface WorkLogReply {
  id: string;
  content: string;
  userId: string;
  user?: {
    id: string;
    full_name: string;
    email: string;
  };
  createdAt: string;
}

export const addWorkLogReply = async (_workLogId: string, message: string): Promise<WorkLogReply> => {
  return {
    id: `reply-${Date.now()}`,
    content: message,
    userId: 'admin-1',
    user: { id: 'admin-1', full_name: 'Admin User', email: 'admin@timeharbor.app' },
    createdAt: new Date().toISOString(),
  };
};

export interface TimesheetDayTotal {
  date: string;
  totalMs: number;
}

export const fetchActivitiesByDateRange = async (
  _teamId: string,
  from: string,
  to: string,
): Promise<Activity[]> => {
  // Only return workSessions — activityLogs are for the dashboard Recent Activity feed
  // Extract local date directly from the ISO string to avoid UTC shift
  // (e.g. "2026-03-24T23:59:59-07:00" → "2026-03-24", not "2026-03-25" via UTC)
  const fromDate = from.slice(0, 10);
  const toDate = to.slice(0, 10);
  const sessions = await db.workSessions
    .where('date')
    .between(fromDate, toDate, true, true)
    .toArray();

  const activities: Activity[] = [];

  for (const s of sessions) {
    const derivedTickets = s.ticketBreakdown?.map(t => t.ticketTitle).filter(Boolean).join(', ') || undefined;
    const subtitle = s.manualTicket || derivedTickets;
    const status = s.manualStatus ?? (s.clockOut ? 'Completed' as const : 'Active' as const);
    const clockInISO = new Date(s.clockIn).toISOString();
    const clockOutISO = s.clockOut ? new Date(s.clockOut).toISOString() : undefined;

    // Clock-in entry — event time is clockIn
    activities.push({
      id: `${s.id}-in`,
      type: 'SESSION',
      title: 'Work Session Started',
      subtitle,
      description: s.comment,
      startTime: clockInISO,
      endTime: clockOutISO,
      status,
      duration: formatDurationMs(s.netWorkMs),
      durationMs: s.netWorkMs,
      metadata: { eventTime: s.clockIn, flag: s.flag },
    });

    // Clock-out entry — event time is clockOut
    if (s.clockOut) {
      activities.push({
        id: `${s.id}-out`,
        type: 'SESSION',
        title: 'Session Ended',
        subtitle,
        description: s.comment,
        startTime: clockInISO,
        endTime: clockOutISO,
        status: s.manualStatus ?? 'Completed',
        duration: formatDurationMs(s.netWorkMs),
        durationMs: s.netWorkMs,
        metadata: { eventTime: s.clockOut, flag: s.flag },
      });
    }
  }

  // Sort by event time descending (newest first)
  return activities.sort((a, b) => (b.metadata?.eventTime ?? 0) - (a.metadata?.eventTime ?? 0));
};

export const getTimesheetTotals = async (
  _from: string,
  _to: string,
  _teamId?: string,
  _memberId?: string,
): Promise<TimesheetDayTotal[]> => {
  const now = Date.now();
  const sessions = await db.workSessions
    .where('date')
    .between(_from, _to, true, true)
    .toArray();

  // Group by date and sum netWorkMs
  const byDate = new Map<string, number>();
  for (const s of sessions) {
    const netMs = s.clockOut === null
      ? computeSession({ clockIn: s.clockIn, clockOut: null, ticketSegments: s.ticketSegments, breaks: s.breaks }, now).netWorkMs
      : s.netWorkMs;
    byDate.set(s.date, (byDate.get(s.date) || 0) + netMs);
  }

  return Array.from(byDate.entries()).map(([date, totalMs]) => ({ date, totalMs }));
};