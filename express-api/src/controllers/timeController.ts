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
 * Emit a live stats socket update WITHOUT writing to user_daily_stats.
 * Used for mid-session events (BREAK_START, BREAK_END, START_TICKET, CLOCK_IN)
 * where we want the dashboard to reflect the current moment but the session
 * isn't closed yet — so no DB write should occur.
 */
async function pushLiveStats(userId: string, teamId: string | null) {
  try {
    const now = new Date();
    const today = localDate(now);

    // Find the open session boundary (latest CLOCK_IN with no following CLOCK_OUT)
    const whereClause: any = { userId };
    if (teamId) whereClause.teamId = teamId;

    const recentEvents = await WorkLog.findAll({
      where: whereClause,
      order: [['timestamp', 'DESC']],
      limit: 200,
      attributes: ['type', 'timestamp'],
    });

    let openSessionStartTs: number | null = null;
    let foundClockOut = false;
    for (const e of recentEvents) {
      if (e.type === 'CLOCK_OUT') { foundClockOut = true; break; }
      if (e.type === 'CLOCK_IN') { openSessionStartTs = new Date(e.timestamp).getTime(); break; }
    }
    if (foundClockOut) return; // session is closed, nothing live to push

    // Read completed stats from DB (not modified by this function)
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const startOfWeekDate = localDate(startOfWeek);

    const updatedRows = await UserDailyStat.findAll({
      where: { userId, ...(teamId ? { teamId } : {}), date: { [Op.between]: [startOfWeekDate, today] } },
      attributes: ['date', 'totalMs'],
    });
    const completedMsToday = updatedRows.filter((r: any) => r.date === today).reduce((a: number, r: any) => a + Number(r.totalMs), 0);
    const completedMsWeek  = updatedRows.reduce((a: number, r: any) => a + Number(r.totalMs), 0);

    let liveMsToday = 0;
    let liveMsWeek  = 0;

    if (openSessionStartTs !== null) {
      const breakEvents = await WorkLog.findAll({
        where: {
          userId,
          type: { [Op.in]: ['BREAK_START', 'BREAK_END'] },
          timestamp: { [Op.gte]: new Date(openSessionStartTs) },
          ...(teamId ? { teamId } : {}),
        },
        order: [['timestamp', 'ASC']],
        attributes: ['type', 'timestamp'],
      });

      let totalBreakMs = 0;
      let breakSegStartMs: number | null = null;
      for (const be of breakEvents) {
        if (be.type === 'BREAK_START') {
          breakSegStartMs = new Date(be.timestamp).getTime();
        } else if (be.type === 'BREAK_END' && breakSegStartMs !== null) {
          totalBreakMs += new Date(be.timestamp).getTime() - breakSegStartMs;
          breakSegStartMs = null;
        }
      }
      // If currently on break, exclude the ongoing break from live time
      if (breakSegStartMs !== null) totalBreakMs += now.getTime() - breakSegStartMs;

      const liveMs = Math.max(0, now.getTime() - openSessionStartTs - totalBreakMs);
      const sessionDate = localDate(new Date(openSessionStartTs));
      if (sessionDate === today) liveMsToday = liveMs;
      liveMsWeek = liveMs;
    }

    const toHM = (ms: number) => {
      const h = Math.floor(ms / 3_600_000);
      const m = Math.floor((ms % 3_600_000) / 60_000);
      return `${h}h ${m}m`;
    };
    const totalMsToday = completedMsToday + liveMsToday;
    const totalMsWeek  = completedMsWeek  + liveMsWeek;

    getIO().to(userId).emit('stats_updated', {
      teamId: teamId ?? null,
      totalHoursToday: toHM(totalMsToday),
      totalHoursWeek: toHM(totalMsWeek),
      totalMsToday,
      totalMsWeek,
    });
  } catch (err) {
    logger.warn('[pushLiveStats] Failed:', err);
  }
}

/**
 * Recompute user_daily_stats for a given (userId, teamId) pair
 * covering the current week. Called ONLY after CLOCK_OUT or STOP_TICKET so that
 * getDashboardStats can read pre-computed totals instead of replaying events.
 * Mid-session events (BREAK_START/END, START_TICKET, CLOCK_IN) use pushLiveStats
 * instead to avoid writing incomplete session data to the DB.
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

    // ---------------------------------------------------------------------------
    // Find the open session boundary: the last CLOCK_IN that has no following
    // CLOCK_OUT. Time from this boundary onwards belongs to the LIVE session and
    // must NOT be written to user_daily_stats — getDashboardStats adds it at
    // read time. Writing it here would cause double-counting (e.g. show 6m
    // instead of 3m when 3m of work + 2m break is in progress).
    // ---------------------------------------------------------------------------
    let openSessionStartTs: number | null = null;
    {
      let lastClockInTs: number | null = null;
      let lastClockOutTs: number | null = null;
      for (const e of events) {
        if (e.type === 'CLOCK_IN') lastClockInTs = new Date(e.timestamp).getTime();
        else if (e.type === 'CLOCK_OUT') lastClockOutTs = new Date(e.timestamp).getTime();
      }
      if (
        lastClockInTs !== null &&
        (lastClockOutTs === null || lastClockInTs > lastClockOutTs)
      ) {
        openSessionStartTs = lastClockInTs;
      }
    }

    // Replay events — only accumulate COMPLETED session time.
    // Stop at the open session boundary so we never pre-write live time.
    const dayTotals = new Map<string, number>();
    let isClockedIn = lastPreEvent
      ? ['CLOCK_IN', 'START_TICKET', 'STOP_TICKET', 'BREAK_END'].includes(lastPreEvent.type) &&
        (openSessionStartTs === null || new Date(lastPreEvent.timestamp).getTime() < openSessionStartTs)
      : false;
    let segStart = startOfWeek.getTime();

    for (const event of events) {
      const eventTs = new Date(event.timestamp).getTime();
      // Stop accumulating at the open session boundary
      if (openSessionStartTs !== null && eventTs >= openSessionStartTs) break;

      if (isClockedIn && eventTs > segStart) {
        accumulateMsByDay(dayTotals, segStart, eventTs);
      }
      segStart = eventTs;
      switch (event.type) {
        case 'CLOCK_IN':
        case 'START_TICKET':
        case 'STOP_TICKET':
        case 'BREAK_END':
          isClockedIn = true;
          break;
        case 'CLOCK_OUT':
        case 'BREAK_START':
          isClockedIn = false;
          break;
      }
    }

    // Upsert each completed-session day's total
    for (const [date, totalMs] of dayTotals) {
      await upsertDailyStat(userId, teamId, date, totalMs);
    }

    // Push updated stats to the user's socket room so the dashboard updates instantly.
    // Include live session time (break-excluded) so the socket value matches what
    // getDashboardStats would return — preventing a visible dip on sync events.
    try {
      const today = localDate(now);
      const startOfWeekDate = localDate(startOfWeek);

      const updatedRows = await UserDailyStat.findAll({
        where: { userId, ...(teamId ? { teamId } : {}), date: { [Op.between]: [startOfWeekDate, today] } },
        attributes: ['date', 'totalMs'],
      });

      let completedMsToday = updatedRows.filter(r => r.date === today).reduce((a, r) => a + Number(r.totalMs), 0);
      let completedMsWeek  = updatedRows.reduce((a, r) => a + Number(r.totalMs), 0);

      // Add live time for the open session (mirrors getDashboardStats logic)
      let liveMsToday = 0;
      let liveMsWeek  = 0;
      if (openSessionStartTs !== null) {
        const breakEventsForLive = await WorkLog.findAll({
          where: {
            userId,
            type: { [Op.in]: ['BREAK_START', 'BREAK_END'] },
            timestamp: { [Op.gte]: new Date(openSessionStartTs) },
            ...(teamId ? { teamId } : {}),
          },
          order: [['timestamp', 'ASC']],
          attributes: ['type', 'timestamp'],
        });

        let totalBreakMs = 0;
        let breakSegStartMs: number | null = null;
        for (const be of breakEventsForLive) {
          if (be.type === 'BREAK_START') {
            breakSegStartMs = new Date(be.timestamp).getTime();
          } else if (be.type === 'BREAK_END' && breakSegStartMs !== null) {
            totalBreakMs += new Date(be.timestamp).getTime() - breakSegStartMs;
            breakSegStartMs = null;
          }
        }
        // If currently on a break, count ongoing break so it is excluded from liveMs
        if (breakSegStartMs !== null) totalBreakMs += now.getTime() - breakSegStartMs;

        const liveMs = Math.max(0, now.getTime() - openSessionStartTs - totalBreakMs);
        const sessionDate = localDate(new Date(openSessionStartTs));
        if (sessionDate === today) liveMsToday = liveMs;
        liveMsWeek = liveMs;
      }

      const toHM = (ms: number) => {
        const h = Math.floor(ms / 3_600_000);
        const m = Math.floor((ms % 3_600_000) / 60_000);
        return `${h}h ${m}m`;
      };
      const totalMsToday = completedMsToday + liveMsToday;
      const totalMsWeek  = completedMsWeek  + liveMsWeek;

      getIO().to(userId).emit('stats_updated', {
        teamId: teamId ?? null,
        totalHoursToday: toHM(totalMsToday),
        totalHoursWeek: toHM(totalMsWeek),
        totalMsToday,
        totalMsWeek,
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

    // Track targets for post-commit stats updates:
    // - statsTargets: full recompute + DB write (CLOCK_OUT and STOP_TICKET only)
    // - liveTargets:  socket-only live push (all other mid-session events)
    const statsTargets = new Set<string>();
    const liveTargets  = new Set<string>();

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
          const target = `${userId}::${finalTeamId}`;
          if (type === 'CLOCK_OUT' || type === 'STOP_TICKET') {
            statsTargets.add(target);
          } else {
            liveTargets.add(target);
          }
        } else {
          console.warn(`Team ${teamId} not found for event ${id}, setting teamId to null`);
        }
      } else {
        const target = `${userId}::null`;
        if (type === 'CLOCK_OUT' || type === 'STOP_TICKET') {
          statsTargets.add(target);
        } else {
          liveTargets.add(target);
        }
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
    // Item 15: Post-commit stats updates — background, non-blocking.
    // CLOCK_OUT / STOP_TICKET → full recompute with DB write.
    // Mid-session events     → live socket push only (no DB write).
    // ---------------------------------------------------------------------------
    setImmediate(async () => {
      for (const target of statsTargets) {
        const [uid, tid] = target.split('::');
        await recomputeStatsForUser(uid, tid === 'null' ? null : tid);
      }
      // liveTargets only need a socket push — skip if already covered by a full recompute
      for (const target of liveTargets) {
        if (statsTargets.has(target)) continue; // full recompute already emits socket
        const [uid, tid] = target.split('::');
        await pushLiveStats(uid, tid === 'null' ? null : tid);
      }
    });

    res.status(200).json({ message: 'Events synced successfully' });

  } catch (error) {
    await transaction.rollback();
    console.error('Error syncing events:', error);
    res.status(500).json({ message: 'Error syncing events', error: (error as Error).message });
  }
};

