import { v4 as uuidv4 } from 'uuid';
import { db, type TimeEventType } from '../db';

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
