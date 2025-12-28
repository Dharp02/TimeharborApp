import Dexie, { type Table } from 'dexie';
import { v4 as uuidv4 } from 'uuid';

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

export class TimeharborDB extends Dexie {
  events!: Table<TimeEvent>;

  constructor() {
    super('TimeharborDB');
    // Keep previous versions for migration history if needed, or just overwrite for dev
    this.version(1).stores({
      attendance: 'id, userId, clockIn, clockOut',
      workLogs: 'id, userId, ticketId, attendanceId, startTime, endTime'
    });
    
    this.version(2).stores({
      attendance: null,
      workLogs: 'id, userId, ticketId, startTime, endTime'
    });

    this.version(3).stores({
      workLogs: null, // Drop old table
      events: 'id, userId, type, timestamp, synced'
    });
  }
}

export const db = new TimeharborDB();

export class LocalTimeStore {
  
  async logEvent(
    userId: string, 
    type: TimeEventType, 
    ticketId: string | null = null, 
    ticketTitle: string | null = null,
    comment: string | null = null,
    teamId: string | null = null
  ): Promise<void> {
    await db.events.add({
      id: uuidv4(),
      userId,
      type,
      timestamp: new Date().toISOString(),
      ticketId,
      teamId,
      ticketTitle,
      comment,
      synced: 0
    });
  }

  async clockIn(userId: string, teamId: string | null = null) {
    return this.logEvent(userId, 'CLOCK_IN', null, null, null, teamId);
  }

  async clockOut(userId: string, comment: string | null = null, teamId: string | null = null) {
    return this.logEvent(userId, 'CLOCK_OUT', null, null, comment, teamId);
  }

  async startTicket(userId: string, ticketId: string, ticketTitle: string, teamId: string | null = null) {
    return this.logEvent(userId, 'START_TICKET', ticketId, ticketTitle, null, teamId);
  }

  async stopTicket(userId: string, ticketId: string, comment: string | null = null, teamId: string | null = null) {
    return this.logEvent(userId, 'STOP_TICKET', ticketId, null, comment, teamId);
  }

  async getPendingEvents() {
    return await db.events.where('synced').equals(0).toArray();
  }

  async clearEvents(eventIds: string[]) {
    await db.events.where('id').anyOf(eventIds).delete();
  }

  async hasPendingData(): Promise<boolean> {
    const count = await db.events.where('synced').equals(0).count();
    return count > 0;
  }
}

export const localTimeStore = new LocalTimeStore();
