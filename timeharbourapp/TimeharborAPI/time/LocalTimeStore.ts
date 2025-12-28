import Dexie, { type Table } from 'dexie';
import { v4 as uuidv4 } from 'uuid';

export interface LocalAttendance {
  id: string;
  userId: string;
  clockIn: string; // ISO string
  clockOut?: string; // ISO string
}

export interface LocalWorkLog {
  id: string;
  userId: string;
  ticketId: string;
  attendanceId: string;
  startTime: string; // ISO string
  endTime?: string; // ISO string
  description?: string;
}

export class TimeharborDB extends Dexie {
  attendance!: Table<LocalAttendance>;
  workLogs!: Table<LocalWorkLog>;

  constructor() {
    super('TimeharborDB');
    this.version(1).stores({
      attendance: 'id, userId, clockIn, clockOut',
      workLogs: 'id, userId, ticketId, attendanceId, startTime, endTime'
    });
  }
}

export const db = new TimeharborDB();

export class LocalTimeStore {
  async startShift(userId: string): Promise<string> {
    const id = uuidv4();
    await db.attendance.add({
      id,
      userId,
      clockIn: new Date().toISOString()
    });
    return id;
  }

  async endShift(id: string): Promise<void> {
    await db.attendance.update(id, {
      clockOut: new Date().toISOString()
    });
  }

  async startTicket(userId: string, ticketId: string, attendanceId: string): Promise<string> {
    const id = uuidv4();
    await db.workLogs.add({
      id,
      userId,
      ticketId,
      attendanceId,
      startTime: new Date().toISOString()
    });
    return id;
  }

  async endTicket(id: string, description?: string): Promise<void> {
    const updates: Partial<LocalWorkLog> = {
      endTime: new Date().toISOString()
    };
    if (description) {
      updates.description = description;
    }
    await db.workLogs.update(id, updates);
  }

  async getPendingSyncData() {
    const attendance = await db.attendance.toArray();
    const workLogs = await db.workLogs.toArray();
    return { attendance, workLogs };
  }

  async clearSyncedData() {
    await db.attendance.clear();
    await db.workLogs.clear();
  }

  async hasPendingData(): Promise<boolean> {
    const attendanceCount = await db.attendance.count();
    const workLogsCount = await db.workLogs.count();
    return attendanceCount > 0 || workLogsCount > 0;
  }
}

export const localTimeStore = new LocalTimeStore();
