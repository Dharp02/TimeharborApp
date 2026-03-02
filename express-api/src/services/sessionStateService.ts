import { WorkLog } from '../models';
import { Op } from 'sequelize';

export interface SessionState {
  isSessionActive: boolean;
  sessionStartTime: string | null;
  isOnBreak: boolean;
  breakStartTime: string | null;
  activeTicketId: string | null;
  activeTicketTitle: string | null;
  activeTicketTeamId: string | null;
  ticketStartTime: string | null;
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

  return {
    isSessionActive,
    sessionStartTime,
    isOnBreak,
    breakStartTime,
    activeTicketId,
    activeTicketTitle,
    activeTicketTeamId,
    ticketStartTime,
  };
}
