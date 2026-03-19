import { mockStats, mockActivities, mockMemberActivity, mockTimesheetTotals } from '../mockData';

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

export const getStats = async (_teamId?: string): Promise<DashboardStats> => {
  return { ...mockStats };
};

export const getActivity = async (_teamId?: string, _limit?: number | 'all'): Promise<Activity[]> => {
  return [...mockActivities];
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
  return { ...mockMemberActivity };
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
  const fromDate = new Date(from).getTime();
  const toDate = new Date(to).getTime();
  return mockActivities.filter(a => {
    const t = new Date(a.startTime).getTime();
    return t >= fromDate && t <= toDate;
  });
};

export const getTimesheetTotals = async (
  _from: string,
  _to: string,
  _teamId?: string,
  _memberId?: string,
): Promise<TimesheetDayTotal[]> => {
  return [...mockTimesheetTotals];
};