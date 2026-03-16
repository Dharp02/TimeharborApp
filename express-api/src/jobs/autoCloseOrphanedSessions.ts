import cron from 'node-cron';
import { Op } from 'sequelize';
import { WorkLog, UserDailyStat } from '../models';
import logger from '../utils/logger';
import sequelize from '../config/sequelize';
import { getIO } from '../socket/socketManager';

const MAX_SESSION_MS = 8 * 60 * 60 * 1000; // 8 hours

const localDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function accumulateMsByDay(
  dayTotals: Map<string, number>,
  fromMs: number,
  toMs: number,
) {
  let current = fromMs;
  while (current < toMs) {
    const d = new Date(current);
    const dayKey = localDate(d);
    const endOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
    const segEnd = Math.min(endOfDay, toMs);
    dayTotals.set(dayKey, (dayTotals.get(dayKey) ?? 0) + (segEnd - current));
    current = segEnd;
  }
}

/**
 * Find orphaned CLOCK_IN events (no matching CLOCK_OUT) older than 8 hours
 * and auto-close them by inserting a CLOCK_OUT exactly 8 hours after the CLOCK_IN.
 * Then recompute stats for affected users.
 */
async function autoCloseOrphanedSessions() {
  const cutoff = new Date(Date.now() - MAX_SESSION_MS);

  try {
    // Find CLOCK_IN events where either:
    // 1. There is no subsequent CLOCK_OUT at all, OR
    // 2. The next CLOCK_OUT is more than 8 hours after the CLOCK_IN
    // Only consider CLOCK_INs older than 8 hours (so we don't touch active valid sessions).
    const orphanedClockIns = await sequelize.query<{
      id: string;
      userId: string;
      teamId: string | null;
      timestamp: Date;
      next_clock_out: Date | null;
    }>(`
      SELECT ci.id, ci."userId", ci."teamId", ci.timestamp,
        (
          SELECT co.timestamp FROM work_logs co
          WHERE co."userId" = ci."userId"
            AND co.type = 'CLOCK_OUT'
            AND co.timestamp > ci.timestamp
            AND (ci."teamId" IS NULL AND co."teamId" IS NULL
                 OR ci."teamId" = co."teamId")
          ORDER BY co.timestamp ASC
          LIMIT 1
        ) as next_clock_out
      FROM work_logs ci
      WHERE ci.type = 'CLOCK_IN'
        AND ci.timestamp < :cutoff
        AND (
          -- No subsequent CLOCK_OUT at all
          NOT EXISTS (
            SELECT 1 FROM work_logs co
            WHERE co."userId" = ci."userId"
              AND co.type = 'CLOCK_OUT'
              AND co.timestamp > ci.timestamp
              AND (ci."teamId" IS NULL AND co."teamId" IS NULL
                   OR ci."teamId" = co."teamId")
          )
          OR
          -- Next CLOCK_OUT is more than 8 hours after CLOCK_IN
          (
            SELECT co.timestamp FROM work_logs co
            WHERE co."userId" = ci."userId"
              AND co.type = 'CLOCK_OUT'
              AND co.timestamp > ci.timestamp
              AND (ci."teamId" IS NULL AND co."teamId" IS NULL
                   OR ci."teamId" = co."teamId")
            ORDER BY co.timestamp ASC
            LIMIT 1
          ) > ci.timestamp + interval '8 hours'
        )
      ORDER BY ci.timestamp ASC
    `, {
      replacements: { cutoff },
      type: 'SELECT' as any,
    });

    if (!orphanedClockIns || orphanedClockIns.length === 0) return;

    logger.info(`[autoCloseOrphaned] Found ${orphanedClockIns.length} orphaned sessions to auto-close.`);

    const affectedPairs = new Set<string>();

    for (const clockIn of orphanedClockIns) {
      const clockInTs = new Date(clockIn.timestamp).getTime();
      const autoClockOutTs = new Date(clockInTs + MAX_SESSION_MS);

      // Also stop any open tickets within this session before auto-clocking out
      const openTickets = await WorkLog.findAll({
        where: {
          userId: clockIn.userId,
          type: 'START_TICKET',
          timestamp: { [Op.gte]: new Date(clockIn.timestamp) },
          ...(clockIn.teamId ? { teamId: clockIn.teamId } : {}),
        },
        order: [['timestamp', 'ASC']],
      });

      // Check which START_TICKETs don't have a matching STOP_TICKET
      for (const startTicket of openTickets) {
        const hasStop = await WorkLog.findOne({
          where: {
            userId: clockIn.userId,
            type: 'STOP_TICKET',
            timestamp: { [Op.gt]: startTicket.timestamp },
            ticketId: startTicket.ticketId,
            ...(clockIn.teamId ? { teamId: clockIn.teamId } : {}),
          },
        });

        if (!hasStop) {
          await WorkLog.create({
            userId: clockIn.userId,
            teamId: clockIn.teamId,
            type: 'STOP_TICKET',
            timestamp: autoClockOutTs,
            ticketId: startTicket.ticketId,
            ticketTitle: startTicket.ticketTitle,
            comment: 'Auto-closed: session exceeded 8 hours',
          });
        }
      }

      // Insert auto CLOCK_OUT
      await WorkLog.create({
        userId: clockIn.userId,
        teamId: clockIn.teamId,
        type: 'CLOCK_OUT',
        timestamp: autoClockOutTs,
        comment: 'Auto-closed: session exceeded 8 hours',
      });

      affectedPairs.add(`${clockIn.userId}::${clockIn.teamId ?? 'null'}`);

      // Notify the frontend so it can clear the clock-in UI state
      try {
        getIO().to(clockIn.userId).emit('session_auto_closed', {
          teamId: clockIn.teamId ?? null,
          reason: 'Session exceeded 8 hours',
        });
      } catch { /* socket may not be initialized in script mode */ }

      logger.info(
        `[autoCloseOrphaned] Auto-clocked out userId=${clockIn.userId} ` +
        `teamId=${clockIn.teamId ?? 'none'} ` +
        `clockIn=${new Date(clockIn.timestamp).toISOString()} ` +
        `autoClockOut=${autoClockOutTs.toISOString()}`
      );
    }

    // Recompute stats for all affected (userId, teamId) pairs
    for (const pair of affectedPairs) {
      const [userId, teamIdStr] = pair.split('::');
      const teamId = teamIdStr === 'null' ? null : teamIdStr;
      await recomputeStatsForPair(userId, teamId);
    }

    logger.info(`[autoCloseOrphaned] Done. Recomputed stats for ${affectedPairs.size} user-team pairs.`);
  } catch (err) {
    logger.error('[autoCloseOrphaned] Error:', err);
  }
}

/**
 * Recompute UserDailyStat for a (userId, teamId) pair from all work_logs.
 * Same logic as the backfill script but scoped to one pair.
 */
async function recomputeStatsForPair(userId: string, teamId: string | null) {
  const firstEvent = await WorkLog.findOne({
    where: teamId ? { userId, teamId } : { userId, teamId: null },
    order: [['timestamp', 'ASC']],
    attributes: ['timestamp'],
  });
  if (!firstEvent) return;

  const startFrom = new Date(firstEvent.timestamp);
  startFrom.setHours(0, 0, 0, 0);

  const events = await WorkLog.findAll({
    where: {
      userId,
      timestamp: { [Op.gte]: startFrom },
      ...(teamId ? { teamId } : { teamId: null }),
    },
    order: [['timestamp', 'ASC']],
    attributes: ['type', 'timestamp'],
  });

  const dayTotals = new Map<string, number>();
  let isClockedIn = false;
  let segStart = startFrom.getTime();

  for (const event of events) {
    const eventTs = new Date(event.timestamp).getTime();
    if (isClockedIn && eventTs > segStart) {
      accumulateMsByDay(dayTotals, segStart, eventTs);
    }
    segStart = eventTs;
    switch (event.type) {
      case 'CLOCK_IN':
      case 'BREAK_END':
        isClockedIn = true;
        break;
      case 'CLOCK_OUT':
      case 'BREAK_START':
        isClockedIn = false;
        break;
      // START_TICKET and STOP_TICKET don't change clock state
    }
  }

  // If still clocked in (live session), don't count to now — the live session
  // boundary is handled at read time by getDashboardStats / getTimesheetTotals
  // No action needed here.

  for (const [date, totalMs] of dayTotals) {
    const [stat, created] = await UserDailyStat.findOrCreate({
      where: { userId, teamId: teamId ?? null, date },
      defaults: { userId, teamId: teamId ?? null, date, totalMs },
    });
    if (!created) {
      await stat.update({ totalMs });
    }
  }
}

/**
 * Start the auto-close orphaned sessions job.
 * Runs every 15 minutes.
 */
export const startAutoCloseJob = () => {
  logger.info('Initializing auto-close orphaned sessions job...');

  cron.schedule('*/15 * * * *', async () => {
    logger.info('[autoCloseOrphaned] Running scheduled check...');
    await autoCloseOrphanedSessions();
  });

  logger.info('Auto-close orphaned sessions job scheduled (runs every 15 minutes).');
};

/**
 * Run auto-close immediately (for testing or manual invocation).
 */
export const runAutoCloseNow = autoCloseOrphanedSessions;
