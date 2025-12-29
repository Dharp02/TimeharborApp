import Dexie, { type Table } from 'dexie';

export interface OfflineMutation {
  id?: number;
  url: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body: any;
  timestamp: number;
  retryCount: number;
}

export interface UserProfile {
  key: string;
  data: any;
}

export type TimeEventType = 'CLOCK_IN' | 'CLOCK_OUT' | 'START_TICKET' | 'STOP_TICKET';

export interface TimeEvent {
  id: string;
  userId: string;
  type: TimeEventType;
  timestamp: string; // ISO string
  ticketId?: string | null;
  teamId?: string | null;
  ticketTitle?: string | null;
  comment?: string | null;
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

export class TimeharborDB extends Dexie {
  offlineMutations!: Table<OfflineMutation>;
  profile!: Table<UserProfile>;
  events!: Table<TimeEvent>;
  teams!: Table<Team>;

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
  }
}

export const db = new TimeharborDB();
