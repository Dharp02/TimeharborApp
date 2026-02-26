import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import { WorkLog, Ticket, Team, Member, User, UserDailyStat } from '../models';
import sequelize from '../config/sequelize';
import logger from '../utils/logger';
import { Op } from 'sequelize';
import { sendClockInNotification, sendClockOutNotification, sendStopTicketNotification } from '../services/notificationService';
import { getIO } from '../socket/socketManager';

// ---------------------------------------------------------------------------
// Helpers for Item 15: stats recompute after sync
// ---------------------------------------------------------------------------

/** Format a Date as local YYYY-MM-DD (not UTC) so day boundaries match the server's clock. */
const localDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Accumulate ms across calendar-day boundaries into dayTotals map. */
function accumulateMsByDay(
  dayTotals: Map<string, number>,
  fromMs: number,
  toMs: number
) {
  let current = fromMs;
  while (current < toMs) {
    const d = new Date(current);
    const dayKey = localDate(d); // local YYYY-MM-DD, not UTC
    const endOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
    const segEnd = Math.min(endOfDay, toMs);
    dayTotals.set(dayKey, (dayTotals.get(dayKey) ?? 0) + (segEnd - current));
    current = segEnd;
  }
}

/** Upsert a single (userId, teamId, date) stats row at the app level. */
async function upsertDailyStat(
  userId: string,
  teamId: string | null,
  date: string,
  totalMs: number
) {
  const [stat, created] = await UserDailyStat.findOrCreate({
    where: { userId, teamId: teamId ?? null, date },
    defaults: { userId, teamId: teamId ?? null, date, totalMs },
  });
  if (!created) {
    await stat.update({ totalMs });
  }
}

/**
 * Recompute user_daily_stats for a given (userId, teamId) pair
 * covering the current week. Called after each successful sync so that
 * getDashboardStats can read pre-computed totals instead of replaying events.
 */
async function recomputeStatsForUser(userId: string, teamId: string | null) {
  try {
    const now = new Date();
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay()); // Sunday

    const whereClause: any = {
      userId,
      timestamp: { [Op.gte]: startOfWeek },
    };
    if (teamId) whereClause.teamId = teamId;

    const preWhereClause: any = {
      userId,
      timestamp: { [Op.lt]: startOfWeek },
    };
    if (teamId) preWhereClause.teamId = teamId;

    const [events, lastPreEvent] = await Promise.all([
      WorkLog.findAll({
        where: whereClause,
        order: [['timestamp', 'ASC']],
        attributes: ['id', 'type', 'timestamp'],
      }),
      WorkLog.findOne({
        where: preWhereClause,
        order: [['timestamp', 'DESC']],
        attributes: ['id', 'type', 'timestamp'],
      }),
    ]);

    // Replay events to compute ms per calendar day
    const dayTotals = new Map<string, number>();
    let isClockedIn = lastPreEvent
      ? ['CLOCK_IN', 'START_TICKET', 'STOP_TICKET'].includes(lastPreEvent.type)
      : false;
    let segStart = startOfWeek.getTime();

    for (const event of events) {
      const eventTs = new Date(event.timestamp).getTime();
      if (isClockedIn && eventTs > segStart) {
        accumulateMsByDay(dayTotals, segStart, eventTs);
      }
      segStart = eventTs;
      switch (event.type) {
        case 'CLOCK_IN':
        case 'START_TICKET':
        case 'STOP_TICKET':
          isClockedIn = true;
          break;
        case 'CLOCK_OUT':
          isClockedIn = false;
          break;
      }
    }

    // Don't add live time here — getDashboardStats adds it at read time.

    // Upsert each day's total
    for (const [date, totalMs] of dayTotals) {
      await upsertDailyStat(userId, teamId, date, totalMs);
    }

    // Push updated stats to the user's socket room so the dashboard updates instantly
    try {
      const today = localDate(new Date());
      const startOfWeekDate = localDate(startOfWeek);
      const updatedRows = await UserDailyStat.findAll({
        where: { userId, ...(teamId ? { teamId } : {}), date: { [Op.between]: [startOfWeekDate, today] } },
        attributes: ['date', 'totalMs'],
      });
      const toHM = (ms: number) => {
        const h = Math.floor(ms / 3_600_000);
        const m = Math.floor((ms % 3_600_000) / 60_000);
        return `${h}h ${m}m`;
      };
      const totalMsToday = updatedRows.filter(r => r.date === today).reduce((a, r) => a + Number(r.totalMs), 0);
      const totalMsWeek  = updatedRows.reduce((a, r) => a + Number(r.totalMs), 0);
      getIO().to(userId).emit('stats_updated', {
        teamId: teamId ?? null,
        totalHoursToday: toHM(totalMsToday),
        totalHoursWeek: toHM(totalMsWeek),
      });
    } catch (e) {
      // Non-critical — don't let socket errors break the sync flow
      logger.warn('[recomputeStatsForUser] Failed to push socket update:', e);
    }
  } catch (err) {
    console.error('[recomputeStatsForUser] Failed:', err);
  }
}

// ---------------------------------------------------------------------------

export const syncTimeData = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  res.status(501).json({ message: 'Use /sync-events endpoint' });
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const syncTimeEvents = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const { events = [] } = req.body;

  if (!Array.isArray(events) || events.length === 0) {
    res.status(200).json({ message: 'No events to sync' });
    return;
  }

  // Sort events by timestamp
  events.sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  // ---------------------------------------------------------------------------
  // Item 16: Bulk-validate all unique ticketIds and teamIds BEFORE the loop.
  // Drops N per-event Ticket.findByPk + Team.findByPk queries → 2 queries total.
  // ---------------------------------------------------------------------------
  const rawTicketIds = [...new Set(
    events.map((e: any) => e.ticketId).filter((id: any) => id && UUID_REGEX.test(id))
  )] as string[];
  const rawTeamIds = [...new Set(
    events.map((e: any) => e.teamId).filter((id: any) => id && UUID_REGEX.test(id))
  )] as string[];
  const rawEventIds = [...new Set(
    events.map((e: any) => e.id).filter(Boolean)
  )] as string[];

  const transaction = await sequelize.transaction();

  try {
    // Bulk fetch — 3 queries for the whole batch regardless of batch size
    const [existingTickets, existingTeams, existingLogs] = await Promise.all([
      rawTicketIds.length > 0
        ? Ticket.findAll({ where: { id: rawTicketIds }, attributes: ['id'], transaction })
        : Promise.resolve([]),
      rawTeamIds.length > 0
        ? Team.findAll({ where: { id: rawTeamIds }, attributes: ['id'], transaction })
        : Promise.resolve([]),
      rawEventIds.length > 0
        ? WorkLog.findAll({ where: { id: rawEventIds }, transaction })
        : Promise.resolve([]),
    ]);

    const validTicketIds = new Set(existingTickets.map((t: any) => t.id));
    const validTeamIds = new Set(existingTeams.map((t: any) => t.id));
    const existingLogMap = new Map(existingLogs.map((l: any) => [l.id, l]));

    // Track unique (userId, teamId) pairs for stats recompute after commit
    const statsTargets = new Set<string>();

    for (const event of events) {
      const { id, type, timestamp, ticketId, teamId, ticketTitle, comment, link } = event;

      // Combine comment + link into a single stored value (no schema migration needed)
      const storedComment = comment && link
        ? `${comment}\n${link}`
        : (link || comment || null);

      // Resolve ticketId — O(1) set lookup instead of DB query
      let finalTicketId: string | null = null;
      if (ticketId && UUID_REGEX.test(ticketId)) {
        if (validTicketIds.has(ticketId)) {
          finalTicketId = ticketId;
        } else {
          console.warn(`Ticket ${ticketId} not found for event ${id}, setting ticketId to null`);
        }
      }

      // Resolve teamId — O(1) set lookup
      let finalTeamId: string | null = null;
      if (teamId && UUID_REGEX.test(teamId)) {
        if (validTeamIds.has(teamId)) {
          finalTeamId = teamId;
          statsTargets.add(`${userId}::${finalTeamId}`);
        } else {
          console.warn(`Team ${teamId} not found for event ${id}, setting teamId to null`);
        }
      } else {
        statsTargets.add(`${userId}::null`);
      }

      const existingLog = id ? existingLogMap.get(id) ?? null : null;

      if (existingLog) {
        await existingLog.update({
          userId,
          type,
          timestamp: new Date(timestamp),
          ticketId: finalTicketId,
          teamId: finalTeamId,
          ticketTitle,
          comment: storedComment,
        }, { transaction });
      } else {
        await WorkLog.create({
          id: id || undefined,
          userId,
          type,
          timestamp: new Date(timestamp),
          ticketId: finalTicketId,
          teamId: finalTeamId,
          ticketTitle,
          comment: storedComment,
        }, { transaction });

        // Push notifications fire in background — unchanged from before
        if (type.toLowerCase() === 'clock_in' && finalTeamId) {
          const capturedTeamId = finalTeamId;
          setImmediate(async () => {
            try {
              const [team, user] = await Promise.all([Team.findByPk(capturedTeamId), User.findByPk(userId)]);
              if (team && user) {
                const leaders = await Member.findAll({ where: { teamId: capturedTeamId, role: 'Leader' }, attributes: ['userId'] });
                const leaderIds = leaders.map((l: any) => l.userId).filter((lid: string) => lid !== userId);
                if (leaderIds.length > 0) {
                  await sendClockInNotification(leaderIds, user.full_name || user.email, team.name, capturedTeamId, userId);
                }
              }
            } catch (err) { console.error('Failed to send clock-in notification:', err); }
          });
        }

        if (type.toLowerCase() === 'clock_out' && finalTeamId) {
          const capturedTeamId = finalTeamId;
          setImmediate(async () => {
            try {
              const [team, user] = await Promise.all([Team.findByPk(capturedTeamId), User.findByPk(userId)]);
              if (team && user) {
                const leaders = await Member.findAll({ where: { teamId: capturedTeamId, role: 'Leader' }, attributes: ['userId'] });
                const leaderIds = leaders.map((l: any) => l.userId).filter((lid: string) => lid !== userId);
                if (leaderIds.length > 0) {
                  await sendClockOutNotification(leaderIds, user.full_name || user.email, team.name, capturedTeamId, userId);
                }
              }
            } catch (err) { console.error('Failed to send clock-out notification:', err); }
          });
        }

        if (type.toLowerCase() === 'stop_ticket' && finalTeamId && finalTicketId) {
          const capturedTeamId = finalTeamId;
          const capturedTicketTitle = ticketTitle || 'Ticket';
          const capturedComment = comment || null;
          const capturedLink = link || null;
          setImmediate(async () => {
            try {
              const [leaders, user] = await Promise.all([
                Member.findAll({ where: { teamId: capturedTeamId, role: 'Leader' }, attributes: ['userId'] }),
                User.findByPk(userId),
              ]);
              if (user) {
                const leaderIds = leaders.map((l: any) => l.userId).filter((lid: string) => lid !== userId);
                if (leaderIds.length > 0) {
                  await sendStopTicketNotification(leaderIds, user.full_name || user.email, capturedTicketTitle, capturedTeamId, userId, capturedComment, capturedLink);
                }
              }
            } catch (err) { console.error('Failed to send stop-ticket notification:', err); }
          });
        }
      }
    }

    await transaction.commit();

    // ---------------------------------------------------------------------------
    // Item 15: Recompute user_daily_stats after commit — background, non-blocking.
    // Dashboard reads pre-computed totals instead of replaying events on every request.
    // ---------------------------------------------------------------------------
    setImmediate(async () => {
      for (const target of statsTargets) {
        const [uid, tid] = target.split('::');
        await recomputeStatsForUser(uid, tid === 'null' ? null : tid);
      }
    });

    res.status(200).json({ message: 'Events synced successfully' });

  } catch (error) {
    await transaction.rollback();
    console.error('Error syncing events:', error);
    res.status(500).json({ message: 'Error syncing events', error: (error as Error).message });
  }
};

