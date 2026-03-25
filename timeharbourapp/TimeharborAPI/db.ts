import Dexie, { type Table } from 'dexie';
import type { TicketSegment, Break, TicketTime } from '@timeharbor/time-engine';

export interface OfflineMutation {
  id?: number;
  url: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body: any;
  timestamp: number;
  retryCount: number;
  tempId?: string; // ID of the temporary record created offline
}

export interface UserProfile {
  key: string;
  data: any;
}

export type TimeEventType = 'CLOCK_IN' | 'CLOCK_OUT' | 'START_TICKET' | 'STOP_TICKET' | 'BREAK_START' | 'BREAK_END';

export interface TimeEvent {
  id: string;
  userId: string;
  type: TimeEventType;
  timestamp: string; // ISO string
  ticketId?: string | null;
  teamId?: string | null;
  ticketTitle?: string | null;
  comment?: string | null;
  link?: string | null;
  synced: number; // 0 for false, 1 for true
}

export interface Member {
  id: string;
  name: string;
  email?: string;
  status: 'online' | 'offline';
  role: 'Leader' | 'Member';
  avatar?: string;
}

export interface Team {
  id: string;
  name: string;
  members: Member[];
  role: 'Leader' | 'Member';
  code: string;
}

export interface Ticket {
  id: string;
  title: string;
  description?: string;
  status: 'Open' | 'In Progress' | 'Closed' | 'Done';
  priority: 'Low' | 'Medium' | 'High';
  link?: string;
  teamId: string;
  createdBy: string;
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
  source?: 'personal' | 'timehuddle';
  syncedWithTimehuddle?: boolean;
  sharedToTimehuddle?: boolean;
  pulseVideo?: {
    url: string;
    recordedAt: string;
    duration: string;
  };
  trackedTime?: string;
  trackedMs?: number;
  teamName?: string;
  projectId?: string;
  projectName?: string;
  creator?: {
    id: string;
    full_name: string;
    email: string;
  };
  assignee?: {
    id: string;
    full_name: string;
    email: string;
  };
}

export interface DexieWorkSession {
  id: string;
  clientSessionId: string;
  _serverId?: string;
  _dirty: 0 | 1;
  _rev: number;
  userId: string;
  date: string; // YYYY-MM-DD
  clockIn: number; // epoch ms
  clockOut: number | null;
  ticketSegments: TicketSegment[];
  breaks: Break[];
  totalSessionMs: number;
  totalBreakMs: number;
  netWorkMs: number;
  ticketBreakdown: TicketTime[];
  comment?: string;
  autoClosedAt?: number;
  sourceApp: 'timeharbor';
  createdAt: number;
  updatedAt: number;
}

export interface SyncMeta {
  collection: string;
  lastPulledAt: string; // ISO
}

export interface DexieNote {
  id: string;
  _serverId?: string;
  _dirty: 0 | 1;
  _rev: number;
  userId: string;
  title: string;
  content: string; // JSON string (BlockNote document)
  _deleted: boolean;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

export interface DexieActivityLog {
  id: string;          // client-generated ID (also used as clientId for server dedup)
  _serverId?: string;
  _dirty: 0 | 1;
  _rev: number;
  userId?: string;
  teamId?: string;
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

export class TimeharborDB extends Dexie {
  offlineMutations!: Table<OfflineMutation>;
  profile!: Table<UserProfile>;
  events!: Table<TimeEvent>;
  teams!: Table<Team>;
  tickets!: Table<Ticket>;
  projects!: Table<any>;
  dashboardStats!: Table<{ teamId: string; data: any; updatedAt: number }>;
  dashboardActivity!: Table<{ id: string; teamId: string; data: any; updatedAt: number }>;
  activityLogs!: Table<DexieActivityLog>;
  workSessions!: Table<DexieWorkSession>;
  syncMeta!: Table<SyncMeta>;
  notes!: Table<DexieNote>;

  constructor() {
    super('TimeharborDB');
    
    // Combined history from lib/db.ts and LocalTimeStore.ts
    this.version(1).stores({
      attendance: 'id, userId, clockIn, clockOut',
      workLogs: 'id, userId, ticketId, attendanceId, startTime, endTime',
      offlineMutations: '++id, timestamp'
    });
    
    this.version(2).stores({
      attendance: null,
      workLogs: 'id, userId, ticketId, startTime, endTime',
      profile: 'key',
      offlineMutations: '++id, timestamp'
    });

    this.version(3).stores({
      workLogs: null, // Drop old table
      events: 'id, userId, type, timestamp, synced'
    });

    this.version(4).stores({
      teams: 'id'
    });

    this.version(5).stores({
      tickets: 'id, teamId'
    });

    this.version(6).stores({
      dashboardStats: 'teamId', // teamId as key, or 'global' for all teams
      dashboardActivity: 'id, teamId'
    });

    this.version(7).stores({
      events: 'id, userId, type, timestamp, synced, teamId'
    });

    this.version(8).stores({
      activityLogs: 'id, teamId, startTime' // Add explicit table for activity logs
    });

    this.version(9).stores({
      projects: 'id, createdBy'
    });

    this.version(10).stores({
      workSessions: 'id, clientSessionId, userId, date, clockIn, clockOut, _dirty, _rev, updatedAt',
      syncMeta: 'collection'
    });

    this.version(11).stores({
      notes: 'id, userId, _serverId, _dirty, _rev, updatedAt',
      activityLogs: 'id, teamId, startTime, _dirty, _rev, userId'
    });

    this.version(12).stores({
      tickets: 'id, teamId, _dirty, _serverId'
    });
  }
}

export const db = typeof window !== 'undefined' ? new TimeharborDB() : {} as TimeharborDB;

/**
 * Wipe the entire local database and re-open a fresh instance.
 * Call this on sign-out to prevent data leaking between users.
 */
export async function clearDatabase() {
  if (typeof window === 'undefined') return;
  await db.delete();
  await db.open();
}
