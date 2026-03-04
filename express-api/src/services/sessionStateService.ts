import { WorkLog } from '../models';
import { Op } from 'sequelize';

export interface SessionState {
  isSessionActive: boolean;
  sessionStartTime: string | null;
  isOnBreak: boolean;
  breakStartTime: string | null;
  /** Sum of all completed break durations (ms) within the current open session. */
  totalBreakMs: number;
  /** Sum of completed break durations (ms) that occurred after the current ticket started. */
  ticketBreakMs: number;
  activeTicketId: string | null;
  activeTicketTitle: string | null;
  activeTicketTeamId: string | null;
  ticketStartTime: string | null;
  /** Server-side Unix timestamp (ms) at which this state was computed — used by clients to discard stale payloads. */
  computedAt: number;
}

/**
 * Compute the current session state for a user by reading their latest
 * WorkLog events for each event class (clock, ticket, break).
 *
 * This is the single source of truth used by:
 *  - activityLogController  – to decide whether 'Active' log entries are stale
 *  - timeController         – to emit the authoritative state via WebSocket after sync
 */
export async function computeCurrentSessionState(userId: string): Promise<SessionState> {
  const [lastClockEvent, lastTicketEvent, lastBreakEvent] = await Promise.all([
    WorkLog.findOne({
      where: { userId, type: { [Op.in]: ['CLOCK_IN', 'CLOCK_OUT'] } },
      order: [['timestamp', 'DESC']],
      attributes: ['id', 'type', 'timestamp'],
    }),
    WorkLog.findOne({
      where: { userId, type: { [Op.in]: ['START_TICKET', 'STOP_TICKET'] } },
      order: [['timestamp', 'DESC']],
      attributes: ['id', 'type', 'timestamp', 'ticketId', 'ticketTitle', 'teamId'],
    }),
    WorkLog.findOne({
      where: { userId, type: { [Op.in]: ['BREAK_START', 'BREAK_END'] } },
      order: [['timestamp', 'DESC']],
      attributes: ['id', 'type', 'timestamp'],
    }),
  ]);

  const isSessionActive = lastClockEvent?.type === 'CLOCK_IN';
  const sessionStartTime = isSessionActive
    ? new Date(lastClockEvent!.timestamp).toISOString()
    : null;

  // A ticket or break can only be active while the session is active
  const isTicketActive     = isSessionActive && lastTicketEvent?.type === 'START_TICKET';
  const activeTicketId     = isTicketActive ? (lastTicketEvent!.ticketId   ?? null) : null;
  const activeTicketTitle  = isTicketActive ? (lastTicketEvent!.ticketTitle ?? null) : null;
  const activeTicketTeamId = isTicketActive ? (lastTicketEvent!.teamId     ?? null) : null;
  const ticketStartTime    = isTicketActive
    ? new Date(lastTicketEvent!.timestamp).toISOString()
    : null;

  const isOnBreak     = isSessionActive && lastBreakEvent?.type === 'BREAK_START';
  const breakStartTime = isOnBreak
    ? new Date(lastBreakEvent!.timestamp).toISOString()
    : null;

  // Compute total completed break time (ms) within the current open session.
  // Ongoing break (if isOnBreak) is intentionally excluded so Device B can
  // start its own live break timer from breakStartTime.
  let totalBreakMs = 0;
  let ticketBreakMs = 0;
  if (isSessionActive && sessionStartTime) {
    const breakEvents = await WorkLog.findAll({
      where: {
        userId,
        type: { [Op.in]: ['BREAK_START', 'BREAK_END'] },
        timestamp: { [Op.gte]: new Date(sessionStartTime) },
      },
      order: [['timestamp', 'ASC']],
      attributes: ['type', 'timestamp'],
    });

    const ticketStartMs = ticketStartTime ? new Date(ticketStartTime).getTime() : null;
    let openBreakStart: number | null = null;
    for (const ev of breakEvents) {
      if (ev.type === 'BREAK_START') {
        openBreakStart = new Date(ev.timestamp).getTime();
      } else if (ev.type === 'BREAK_END' && openBreakStart !== null) {
        const breakDuration = new Date(ev.timestamp).getTime() - openBreakStart;
        totalBreakMs += breakDuration;
        // Only count breaks that started at or after the current ticket started.
        if (ticketStartMs !== null && openBreakStart >= ticketStartMs) {
          ticketBreakMs += breakDuration;
        }
        openBreakStart = null;
      }
    }
    // openBreakStart !== null → ongoing break, not counted in totals.
  }

  return {
    isSessionActive,
    sessionStartTime,
    isOnBreak,
    breakStartTime,
    totalBreakMs,
    ticketBreakMs,
    activeTicketId,
    activeTicketTitle,
    activeTicketTeamId,
    ticketStartTime,
    computedAt: Date.now(),
  };
}
