import { v4 as uuidv4 } from 'uuid';
import { db, type DexieWorkSession, type SessionAttachment } from '../db';
import { computeSession } from '@timeharbor/time-engine';
import { operationsLog } from '../OperationsLog';
import { opLogWriter } from '../sync/OpLogWriter';

export interface ClockOutOptions {
  comment?: string;
  links?: string[];
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

    try {
      await db.workSessions.add(session);
      await opLogWriter.recordCreate('workSessions', session.id, session as unknown as Record<string, unknown>);
      await operationsLog.log({ category: 'SESSION', action: 'CLOCK_IN', result: 'success', target: 'WorkSession', targetId: session.id });
      return session;
    } catch (err: any) {
      await operationsLog.log({ category: 'SESSION', action: 'CLOCK_IN', result: 'failure', target: 'WorkSession', errorMessage: err?.message });
      throw err;
    }
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

    const result = await this.commitSession(session, now);
    await operationsLog.log({ category: 'SESSION', action: 'START_TICKET', result: 'success', target: 'Ticket', targetId: ticketId, details: { sessionId, ticketTitle } });
    return result;
  }

  async stopTicket(sessionId: string, options?: ClockOutOptions): Promise<DexieWorkSession> {
    const session = await db.workSessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    const now = Date.now();
    const stoppedTicketId = session.ticketSegments.find(seg => seg.end === null)?.ticketId;

    // Close the open segment
    session.ticketSegments = session.ticketSegments.map(seg =>
      seg.end === null ? { ...seg, end: now } : seg
    );

    // Save optional data to session
    if (options) {
      if (options.comment) session.comment = options.comment;
      if (options.links?.length) session.links = options.links;
      if (options.attachments?.length) session.attachments = options.attachments;
    }

    const result = await this.commitSession(session, now);
    await operationsLog.log({ category: 'SESSION', action: 'STOP_TICKET', result: 'success', target: 'Ticket', targetId: stoppedTicketId, details: { sessionId } });
    return result;
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

    const result = await this.commitSession(session, now);
    await operationsLog.log({ category: 'SESSION', action: 'SWITCH_TICKET', result: 'success', target: 'Ticket', targetId: ticketId, details: { sessionId, ticketTitle } });
    return result;
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

    const result = await this.commitSession(session, now);
    await operationsLog.log({ category: 'SESSION', action: 'START_BREAK', result: 'success', target: 'WorkSession', targetId: sessionId });
    return result;
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

    const result = await this.commitSession(session, now);
    await operationsLog.log({ category: 'SESSION', action: 'END_BREAK', result: 'success', target: 'WorkSession', targetId: sessionId });
    return result;
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
      if (options.links?.length) session.links = options.links;
      if (options.attachments?.length) session.attachments = options.attachments;
    }

    const result = await this.commitSession(session, now);
    await operationsLog.log({ category: 'SESSION', action: 'CLOCK_OUT', result: 'success', target: 'WorkSession', targetId: sessionId });
    return result;
  }


  async forceAutoClockOut(sessionId: string): Promise<DexieWorkSession | null> {
    const session = await db.workSessions.get(sessionId);
    if (!session || session.clockOut !== null) return null;

    const MAX_SESSION_MS = 8 * 60 * 60 * 1000;
    const forcedOutTime = session.clockIn + MAX_SESSION_MS;

    // Close open segments
    session.ticketSegments = session.ticketSegments.map(seg =>
      seg.end === null ? { ...seg, end: forcedOutTime } : seg
    );

    // Close open break
    session.breaks = session.breaks.map(b =>
      b.end === null ? { ...b, end: forcedOutTime } : b
    );

    session.clockOut = forcedOutTime;
    session.comment = (session.comment ? session.comment + '\n' : '') + 'Auto-clocked out after 8 hours.';

    const result = await this.commitSession(session, forcedOutTime);
    await operationsLog.log({ category: 'SESSION', action: 'CLOCK_OUT', result: 'success', target: 'WorkSession', targetId: sessionId, details: { auto: true } });
    return result;
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
    session.updatedAt = now;

    await db.workSessions.put(session);
    await opLogWriter.recordUpdate('workSessions', session.id, {
      ticketSegments: session.ticketSegments,
      breaks: session.breaks,
      clockOut: session.clockOut,
      totalSessionMs: session.totalSessionMs,
      totalBreakMs: session.totalBreakMs,
      netWorkMs: session.netWorkMs,
      ticketBreakdown: session.ticketBreakdown,
      comment: session.comment,
      links: session.links,
      attachments: session.attachments,
      updatedAt: session.updatedAt,
    });
    return session;
  }
}

export const sessionManager = new SessionManager();
