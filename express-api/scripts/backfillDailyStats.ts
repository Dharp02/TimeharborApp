/**
 * One-time backfill script: recompute user_daily_stats from all work_logs.
 *
 * Run with:
 *   cd express-api && npx ts-node scripts/backfillDailyStats.ts
 */
import { Op } from 'sequelize';
import sequelize from '../src/config/sequelize';
import { WorkLog, UserDailyStat } from '../src/models';

const localDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function accumulateMsByDay(dayTotals: Map<string, number>, fromMs: number, toMs: number) {
  let current = fromMs;
  while (current < toMs) {
    const d = new Date(current);
    const dayKey = localDate(d); // local date, not UTC
    const endOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
    const segEnd = Math.min(endOfDay, toMs);
    dayTotals.set(dayKey, (dayTotals.get(dayKey) ?? 0) + (segEnd - current));
    current = segEnd;
  }
}

async function upsertDailyStat(userId: string, teamId: string | null, date: string, totalMs: number) {
  const [stat, created] = await UserDailyStat.findOrCreate({
    where: { userId, teamId: teamId ?? null, date },
    defaults: { userId, teamId: teamId ?? null, date, totalMs },
  });
  if (!created) {
    await stat.update({ totalMs });
  }
}

async function recomputeForPair(userId: string, teamId: string | null) {
  // Get the very first event to find the earliest date
  const firstEvent = await WorkLog.findOne({
    where: teamId ? { userId, teamId } : { userId },
    order: [['timestamp', 'ASC']],
    attributes: ['timestamp'],
  });
  if (!firstEvent) return;

  const startFrom = new Date(firstEvent.timestamp);
  startFrom.setHours(0, 0, 0, 0);

  const whereClause: any = {
    userId,
    timestamp: { [Op.gte]: startFrom },
  };
  if (teamId) whereClause.teamId = teamId;

  const events = await WorkLog.findAll({
    where: whereClause,
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
      case 'START_TICKET':
      case 'STOP_TICKET':
        isClockedIn = true;
        break;
      case 'CLOCK_OUT':
        isClockedIn = false;
        break;
    }
  }

  // If still clocked in right now, count up to now
  if (isClockedIn) {
    accumulateMsByDay(dayTotals, segStart, Date.now());
  }

  for (const [date, totalMs] of dayTotals) {
    await upsertDailyStat(userId, teamId, date, totalMs);
  }

  console.log(`  userId=${userId} teamId=${teamId ?? 'null'} → ${dayTotals.size} days`);
}

async function main() {
  await sequelize.authenticate();
  console.log('Connected. Finding unique (userId, teamId) pairs...');

  const pairs = await WorkLog.findAll({
    attributes: [
      [sequelize.fn('DISTINCT', sequelize.col('userId')), 'userId'],
      'teamId',
    ],
    group: ['userId', 'teamId'],
    raw: true,
  }) as unknown as { userId: string; teamId: string | null }[];

  console.log(`Found ${pairs.length} pairs to backfill.`);

  for (const { userId, teamId } of pairs) {
    await recomputeForPair(userId, teamId);
  }

  console.log('Backfill complete.');
  await sequelize.close();
}

main().catch(e => { console.error(e); process.exit(1); });
