import { v4 as uuidv4 } from 'uuid';
import { db, type DexieWorkSession, type SessionAttachment } from '../db';
import { computeSession } from '@timeharbor/time-engine';

export interface ClockOutOptions {
  comment?: string;
  link?: string;
  attachments?: SessionAttachment[];
}

/**
 * SessionManager — per-session document manager.
 *
 * Every user action mutates the SAME session document in Dexie,
 * then recomputes totals via computeSession().
 *
 * This replaces the old event-based LocalTimeStore.
 */
export class SessionManager {

  /** Get the currently open session for a user (clockOut === null) */
  async getOpenSession(userId: string): Promise<DexieWorkSession | undefined> {
    return db.workSessions
      .where('userId').equals(userId)
      .filter(s => s.clockOut === null)
      .first();
  }

  // ── Mutations ──

  async clockIn(userId: string): Promise<DexieWorkSession> {
    const now = Date.now();
    const dateStr = new Date(now).toISOString().slice(0, 10); // YYYY-MM-DD

    const session: DexieWorkSession = {
      id: uuidv4(),
      clientSessionId: uuidv4(),
      _dirty: 1,
      _rev: 1,
      userId,
      date: dateStr,
      clockIn: now,
      clockOut: null,
      ticketSegments: [],
      breaks: [],
      totalSessionMs: 0,
      totalBreakMs: 0,
      netWorkMs: 0,
      ticketBreakdown: [],
      sourceApp: 'timeharbor',
      createdAt: now,
      updatedAt: now,
    };

    await db.workSessions.add(session);
    return session;
  }

  async startTicket(
    sessionId: string,
    ticketId: string,
    ticketTitle: string
  ): Promise<DexieWorkSession> {
    const session = await db.workSessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    const now = Date.now();

    // Close any open segment
    session.ticketSegments = session.ticketSegments.map(seg =>
      seg.end === null ? { ...seg, end: now } : seg
    );

    // Push new segment
    session.ticketSegments.push({
      segmentId: uuidv4(),
      ticketId,
      ticketTitle,
      start: now,
      end: null,
    });

    return this.commitSession(session, now);
  }

  async stopTicket(sessionId: string, options?: ClockOutOptions): Promise<DexieWorkSession> {
    const session = await db.workSessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    const now = Date.now();

    // Close the open segment
    session.ticketSegments = session.ticketSegments.map(seg =>
      seg.end === null ? { ...seg, end: now } : seg
    );

    // Save optional data to session
    if (options) {
      if (options.comment) session.comment = options.comment;
      if (options.link) session.link = options.link;
      if (options.attachments?.length) session.attachments = options.attachments;
    }

    return this.commitSession(session, now);
  }

  async switchTicket(
    sessionId: string,
    ticketId: string,
    ticketTitle: string
  ): Promise<DexieWorkSession> {
    const session = await db.workSessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    const now = Date.now();

    // Close current segment
    session.ticketSegments = session.ticketSegments.map(seg =>
      seg.end === null ? { ...seg, end: now } : seg
    );

    // Open new segment
    session.ticketSegments.push({
      segmentId: uuidv4(),
      ticketId,
      ticketTitle,
      start: now,
      end: null,
    });

    return this.commitSession(session, now);
  }

  async startBreak(sessionId: string): Promise<DexieWorkSession> {
    const session = await db.workSessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    const now = Date.now();

    // Close active ticket segment (will be resumed on endBreak)
    session.ticketSegments = session.ticketSegments.map(seg =>
      seg.end === null ? { ...seg, end: now } : seg
    );

    // Push new break
    session.breaks.push({
      breakId: uuidv4(),
      start: now,
      end: null,
    });

    return this.commitSession(session, now);
  }

  async endBreak(
    sessionId: string,
    preBreakTicketId?: string | null,
    preBreakTicketTitle?: string | null
  ): Promise<DexieWorkSession> {
    const session = await db.workSessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    const now = Date.now();

    // Close the open break
    session.breaks = session.breaks.map(b =>
      b.end === null ? { ...b, end: now } : b
    );

    // Resume pre-break ticket if provided
    if (preBreakTicketId && preBreakTicketTitle) {
      session.ticketSegments.push({
        segmentId: uuidv4(),
        ticketId: preBreakTicketId,
        ticketTitle: preBreakTicketTitle,
        start: now,
        end: null,
      });
    }

    return this.commitSession(session, now);
  }

  async clockOut(sessionId: string, options?: string | ClockOutOptions): Promise<DexieWorkSession> {
    const session = await db.workSessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    const now = Date.now();

    // Close any open segment
    session.ticketSegments = session.ticketSegments.map(seg =>
      seg.end === null ? { ...seg, end: now } : seg
    );

    // Close any open break
    session.breaks = session.breaks.map(b =>
      b.end === null ? { ...b, end: now } : b
    );

    session.clockOut = now;

    // Support both old string signature and new options object
    if (typeof options === 'string') {
      session.comment = options;
    } else if (options) {
      if (options.comment) session.comment = options.comment;
      if (options.link) session.link = options.link;
      if (options.attachments?.length) session.attachments = options.attachments;
    }

    return this.commitSession(session, now);
  }

  // ── Internal: recompute + persist ──

  private async commitSession(
    session: DexieWorkSession,
    now: number
  ): Promise<DexieWorkSession> {
    const stats = computeSession(
      {
        clockIn: session.clockIn,
        clockOut: session.clockOut,
        ticketSegments: session.ticketSegments,
        breaks: session.breaks,
      },
      now
    );

    session.totalSessionMs = stats.totalSessionMs;
    session.totalBreakMs = stats.totalBreakMs;
    session.netWorkMs = stats.netWorkMs;
    session.ticketBreakdown = stats.ticketBreakdown;
    session._dirty = 1;
    session._rev += 1;
    session.updatedAt = now;

    await db.workSessions.put(session);
    return session;
  }
}

export const sessionManager = new SessionManager();
