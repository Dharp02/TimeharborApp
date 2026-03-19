import type { DashboardStats, Activity, MemberActivityData, TimesheetDayTotal, WorkLogReply } from './dashboard';
import type { Ticket } from './tickets';
import type { Notification } from './notifications';

const MOCK_USER_ID = 'admin-1';

export const mockUser = {
  id: MOCK_USER_ID,
  email: 'admin@timeharbor.app',
  full_name: 'Admin User',
  email_verified: true,
  created_at: '2025-01-01T00:00:00.000Z',
  updated_at: '2025-01-01T00:00:00.000Z',
};

export const mockStats: DashboardStats = {
  totalHoursToday: '2h 30m',
  totalHoursWeek: '12h 15m',
  totalMsToday: 9000000,
  totalMsWeek: 44100000,
  openTickets: 3,
  teamMembers: 5,
};

export const mockTickets: Ticket[] = [
  {
    id: 'ticket-1',
    title: 'Set up CI/CD pipeline',
    description: 'Configure GitHub Actions for automated builds and deployments',
    status: 'Open',
    priority: 'High',
    teamId: '__personal__',
    createdBy: MOCK_USER_ID,
    createdAt: '2026-03-15T09:00:00.000Z',
    updatedAt: '2026-03-15T09:00:00.000Z',
  },
  {
    id: 'ticket-2',
    title: 'Fix dark mode toggle',
    description: 'Theme toggle not persisting after page refresh',
    status: 'In Progress',
    priority: 'Medium',
    teamId: '__personal__',
    createdBy: MOCK_USER_ID,
    createdAt: '2026-03-16T10:30:00.000Z',
    updatedAt: '2026-03-17T14:00:00.000Z',
  },
  {
    id: 'ticket-3',
    title: 'Add date range filter to activity page',
    description: 'Allow users to filter activities by custom date ranges',
    status: 'Open',
    priority: 'Low',
    teamId: '__personal__',
    createdBy: MOCK_USER_ID,
    createdAt: '2026-03-14T08:00:00.000Z',
    updatedAt: '2026-03-14T08:00:00.000Z',
  },
  {
    id: 'ticket-4',
    title: 'Refactor dashboard summary component',
    description: 'Break down into smaller sub-components for better maintainability',
    status: 'Closed',
    priority: 'Medium',
    teamId: '__personal__',
    createdBy: MOCK_USER_ID,
    createdAt: '2026-03-10T11:00:00.000Z',
    updatedAt: '2026-03-13T16:00:00.000Z',
  },
];

export const mockActivities: Activity[] = [
  {
    id: 'activity-1',
    userId: MOCK_USER_ID,
    type: 'SESSION',
    title: 'Work Session',
    subtitle: 'Clocked In',
    startTime: '2026-03-18T09:00:00.000Z',
    status: 'Active',
    durationMs: 9000000,
  },
  {
    id: 'activity-2',
    userId: MOCK_USER_ID,
    type: 'TICKET',
    title: 'Started: Fix dark mode toggle',
    subtitle: 'Ticket Timer',
    startTime: '2026-03-18T09:15:00.000Z',
    endTime: '2026-03-18T11:00:00.000Z',
    status: 'Completed',
    durationMs: 6300000,
  },
  {
    id: 'activity-3',
    userId: MOCK_USER_ID,
    type: 'SESSION',
    title: 'Work Session',
    subtitle: 'Clocked Out',
    startTime: '2026-03-17T08:30:00.000Z',
    endTime: '2026-03-17T17:00:00.000Z',
    status: 'Completed',
    durationMs: 30600000,
  },
  {
    id: 'activity-4',
    userId: MOCK_USER_ID,
    type: 'TICKET',
    title: 'Completed: Refactor dashboard summary',
    subtitle: 'Ticket Closed',
    startTime: '2026-03-17T14:00:00.000Z',
    endTime: '2026-03-17T16:00:00.000Z',
    status: 'Completed',
    durationMs: 7200000,
  },
  {
    id: 'activity-5',
    userId: MOCK_USER_ID,
    type: 'SESSION',
    title: 'Work Session',
    subtitle: 'Clocked Out',
    startTime: '2026-03-16T09:00:00.000Z',
    endTime: '2026-03-16T17:30:00.000Z',
    status: 'Completed',
    durationMs: 30600000,
  },
];

export const mockNotifications: Notification[] = [
  {
    id: 'notif-1',
    userId: MOCK_USER_ID,
    title: 'Ticket Assigned',
    body: 'You have been assigned to "Set up CI/CD pipeline"',
    type: 'ticket_assigned',
    readAt: null,
    createdAt: '2026-03-18T09:05:00.000Z',
  },
  {
    id: 'notif-2',
    userId: MOCK_USER_ID,
    title: 'Session Reminder',
    body: 'You have been clocked in for over 8 hours',
    type: 'session_reminder',
    readAt: null,
    createdAt: '2026-03-17T17:00:00.000Z',
  },
  {
    id: 'notif-3',
    userId: MOCK_USER_ID,
    title: 'Weekly Summary',
    body: 'You logged 40h 15m last week across 5 tickets',
    type: 'weekly_summary',
    readAt: '2026-03-17T08:00:00.000Z',
    createdAt: '2026-03-16T08:00:00.000Z',
  },
];

export const mockMemberActivity: MemberActivityData = {
  member: {
    id: MOCK_USER_ID,
    name: 'Admin User',
    email: 'admin@timeharbor.app',
    role: 'Leader',
    status: 'online',
  },
  timeTracking: {
    today: {
      duration: '2h 30m',
      totalMs: 9000000,
      clockEvents: [
        { type: 'CLOCK_IN', timestamp: '2026-03-18T09:00:00.000Z', time: '9:00 AM' },
      ],
    },
    week: {
      duration: '12h 15m',
      totalMs: 44100000,
    },
    month: {
      duration: '85h 30m',
      totalMs: 307800000,
    },
  },
  recentTickets: [
    { id: 'ticket-2', title: 'Fix dark mode toggle', lastWorkedOn: '2026-03-18T11:00:00.000Z' },
    { id: 'ticket-1', title: 'Set up CI/CD pipeline', lastWorkedOn: '2026-03-17T16:00:00.000Z' },
  ],
  sessions: [],
};

export const mockTimesheetTotals: TimesheetDayTotal[] = [
  { date: '2026-03-18', totalMs: 9000000 },
  { date: '2026-03-17', totalMs: 30600000 },
  { date: '2026-03-16', totalMs: 30600000 },
  { date: '2026-03-15', totalMs: 0 },
  { date: '2026-03-14', totalMs: 28800000 },
];
