
import { Response } from 'express';
import { Op } from 'sequelize';
import { AuthRequest } from '../middleware/authMiddleware';
import { Ticket, Member, Team, WorkLog, User, WorkLogReply, UserDailyStat } from '../models';
import sequelize from '../config/sequelize';
import { sendNotificationToUser } from '../services/notificationService';

// ---------------------------------------------------------------------------
// Item 14: getDashboardStats — reads from user_daily_stats (pre-computed).
// Drops the O(n) event-replay loop → single aggregation query (< 2ms).
// ---------------------------------------------------------------------------
export const getDashboardStats = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { teamId } = req.query;

    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const now = new Date();
    // Use local date (not UTC) so stats align with the user's calendar day
    const localDate = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const today = localDate(now);
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay());
    const startOfWeekDate = localDate(startOfWeek);

    // 1. Read pre-computed stats for this week in one query
    const statsWhere: any = {
      userId,
      date: { [Op.between]: [startOfWeekDate, today] },
    };
    if (teamId) statsWhere.teamId = teamId as string;

    const statRows = await UserDailyStat.findAll({ where: statsWhere, attributes: ['date', 'totalMs'] });

    let totalMsToday = statRows
      .filter(r => r.date === today)
      .reduce((acc, r) => acc + Number(r.totalMs), 0);
    let totalMsWeek = statRows.reduce((acc, r) => acc + Number(r.totalMs), 0);

    // 2. Add live time for any currently-active CLOCK_IN session (not yet clocked out),
    //    minus any break time accumulated since the session started.
    const lastClockEventWhere: any = { userId, type: { [Op.in]: ['CLOCK_IN', 'CLOCK_OUT'] } };
    if (teamId) lastClockEventWhere.teamId = teamId as string;

    const lastClockEvent = await WorkLog.findOne({
      where: lastClockEventWhere,
      order: [['timestamp', 'DESC']],
      attributes: ['type', 'timestamp'],
    });

    if (lastClockEvent?.type === 'CLOCK_IN') {
      const sessionStartMs = new Date(lastClockEvent.timestamp).getTime();

      // Sum up all completed break durations since the session started
      const breakEventsWhere: any = {
        userId,
        type: { [Op.in]: ['BREAK_START', 'BREAK_END'] },
        timestamp: { [Op.gte]: lastClockEvent.timestamp },
      };
      if (teamId) breakEventsWhere.teamId = teamId as string;

      const breakEvents = await WorkLog.findAll({
        where: breakEventsWhere,
        order: [['timestamp', 'ASC']],
        attributes: ['type', 'timestamp'],
      });

      let totalBreakMsLive = 0;
      let breakSegStart: number | null = null;
      for (const be of breakEvents) {
        if (be.type === 'BREAK_START') {
          breakSegStart = new Date(be.timestamp).getTime();
        } else if (be.type === 'BREAK_END' && breakSegStart !== null) {
          totalBreakMsLive += new Date(be.timestamp).getTime() - breakSegStart;
          breakSegStart = null;
        }
      }
      // If currently on break (BREAK_START without matching BREAK_END), add ongoing break time
      if (breakSegStart !== null) {
        totalBreakMsLive += now.getTime() - breakSegStart;
      }

      const liveMs = Math.max(0, now.getTime() - sessionStartMs - totalBreakMsLive);
      if (liveMs > 0) {
        const sessionDate = new Date(lastClockEvent.timestamp).toISOString().slice(0, 10);
        if (sessionDate === today) totalMsToday += liveMs;
        totalMsWeek += liveMs;
      }
    }

    const toHM = (ms: number) => {
      const h = Math.floor(ms / 3_600_000);
      const m = Math.floor((ms % 3_600_000) / 60_000);
      return `${h}h ${m}m`;
    };

    // 3. Open ticket count + team member count — run in parallel
    const ticketWhere: any = { assignedTo: userId, status: { [Op.ne]: 'Closed' } };
    if (teamId) ticketWhere.teamId = teamId;

    const [openTicketsCount, teamMembersCount] = await Promise.all([
      Ticket.count({ where: ticketWhere }),
      teamId ? Member.count({ where: { teamId: teamId as string } }) : Promise.resolve(0),
    ]);

    res.json({
      totalHoursToday: toHM(totalMsToday),
      totalHoursWeek: toHM(totalMsWeek),
      totalMsToday,
      totalMsWeek,
      openTickets: openTicketsCount,
      teamMembers: teamMembersCount,
    });

  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ message: 'Error fetching dashboard stats' });
  }
};

export const getRecentActivity = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { teamId, limit, from, to } = req.query;

    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    // ---------------------------------------------------------------------------
    // Date-range mode: used by the timesheet page.
    // Returns individual formatted events from work_logs (the source of truth),
    // NOT grouped sessions. This replaces the formerly activity_logs-based path.
    // ---------------------------------------------------------------------------
    if (from && to) {
      const whereClause: any = {
        userId,
        timestamp: { [Op.between]: [new Date(from as string), new Date(to as string)] },
      };
      if (teamId) whereClause.teamId = teamId as string;

      const events = await WorkLog.findAll({
        where: whereClause,
        order: [['timestamp', 'ASC']],
        limit: 2000,
      });

      const typeMap: Record<string, string> = {
        CLOCK_IN: 'SESSION', CLOCK_OUT: 'SESSION',
        BREAK_START: 'BREAK', BREAK_END: 'BREAK',
        START_TICKET: 'TICKET', STOP_TICKET: 'TICKET',
      };

      // Format ms → "Xh Xm Xs" with seconds precision for individual-event view
      const toHMS = (ms: number) => {
        const h = Math.floor(ms / 3_600_000);
        const m = Math.floor((ms % 3_600_000) / 60_000);
        const s = Math.floor((ms % 60_000) / 1_000);
        return `${h}h ${m}m ${s}s`;
      };

      // --- Forward pass: compute CLOCK_OUT durations (break-excluded) ---
      let sessionStartMs: number | null = null;
      let breakStartMs: number | null = null;
      let accumulatedBreakMs = 0;
      const clockOutDurationMap = new Map<string, number>();

      // --- Also track active tickets: START_TICKET id → ticketId ---
      // After the pass, any START_TICKET id still in the map has no STOP_TICKET.
      const openTickets = new Map<string, string>(); // ticketId → START_TICKET event id
      const activeEventIds = new Set<string>();       // event ids that are "Active"

      // Track open clock-in (no CLOCK_OUT yet) to mark as Active
      let openClockInId: string | null = null;

      for (const e of events) {
        const ts = new Date(e.timestamp).getTime();
        switch (e.type) {
          case 'CLOCK_IN':
            sessionStartMs = ts;
            accumulatedBreakMs = 0;
            breakStartMs = null;
            openClockInId = e.id;
            break;
          case 'BREAK_START':
            breakStartMs = ts;
            break;
          case 'BREAK_END':
            if (breakStartMs !== null) {
              accumulatedBreakMs += ts - breakStartMs;
              breakStartMs = null;
            }
            break;
          case 'CLOCK_OUT':
            if (sessionStartMs !== null) {
              const extraBreak = breakStartMs !== null ? ts - breakStartMs : 0;
              const worked = Math.max(0, ts - sessionStartMs - accumulatedBreakMs - extraBreak);
              clockOutDurationMap.set(e.id, worked);
            }
            sessionStartMs = null;
            breakStartMs = null;
            accumulatedBreakMs = 0;
            openClockInId = null;
            break;
          case 'START_TICKET': {
            const tid = e.ticketId || e.id;
            openTickets.set(tid, e.id);
            break;
          }
          case 'STOP_TICKET': {
            const tid = e.ticketId || e.id;
            openTickets.delete(tid);
            break;
          }
        }
      }

      // Any START_TICKET still in openTickets has no matching STOP — mark as Active
      for (const eventId of openTickets.values()) {
        activeEventIds.add(eventId);
      }
      // Open CLOCK_IN (no CLOCK_OUT) → Active
      if (openClockInId) activeEventIds.add(openClockInId);

      const formatted = events.map(e => {
        const workedMs = e.type === 'CLOCK_OUT' ? (clockOutDurationMap.get(e.id) ?? 0) : undefined;
        const isActive = activeEventIds.has(e.id);
        const durStr = workedMs !== undefined ? toHMS(workedMs) : undefined;

        // Human-readable titles & subtitles matching the original activity log format
        let title: string;
        let subtitle: string | undefined;
        switch (e.type) {
          case 'CLOCK_IN':
            title = 'Work Session Started';
            subtitle = 'Clocked In';
            break;
          case 'CLOCK_OUT':
            title = 'Session Ended';
            subtitle = durStr ? `Duration: ${durStr}` : 'Session Ended';
            break;
          case 'BREAK_START':
            title = 'Break Started';
            subtitle = undefined;
            break;
          case 'BREAK_END':
            title = 'Break Ended';
            subtitle = undefined;
            break;
          case 'START_TICKET':
            title = 'Started Ticket';
            subtitle = e.ticketTitle || undefined;
            break;
          case 'STOP_TICKET':
            title = 'Stopped Ticket';
            subtitle = e.ticketTitle || undefined;
            break;
          default:
            title = e.type;
            subtitle = undefined;
        }

        return {
          id: e.id,
          type: typeMap[e.type] || 'SESSION',
          title,
          subtitle,
          description: e.comment || undefined,
          startTime: e.timestamp,
          endTime: undefined,
          status: (isActive ? 'Active' : 'Completed') as 'Active' | 'Completed',
          duration: durStr,
          durationMs: workedMs ?? 0,
        };
      });

      // Return newest-first so the All Activity page displays in chronological DESC order
      res.json(formatted.reverse());
      return;
    }

    // ---------------------------------------------------------------------------
    // Session-grouping mode: used by the dashboard recent activity panel.
    // ---------------------------------------------------------------------------

    // Fetch recent work logs (events)
    const eventsWhereClause: any = { userId };
    if (teamId) {
      eventsWhereClause.teamId = teamId;
    }

    const isAll = limit === 'all';
    const limitNum = typeof limit === 'string' && !isAll ? parseInt(limit) : 5;
    
    // Fetch events to reconstruct sessions
    // If 'all', fetch more events (e.g., last 1000)
    // If specific limit, fetch enough events to likely cover it (e.g. limit * 10)
    const eventLimit = isAll ? 1000 : (limitNum * 20);

    const events = await WorkLog.findAll({
      where: eventsWhereClause,
      order: [['timestamp', 'DESC']],
      limit: eventLimit
    });

    // Process events chronologically
    const processedEvents = events.reverse();
    const sessions: any[] = [];
    let currentSession: any = null;

    for (const event of processedEvents) {
      if (event.type === 'CLOCK_IN') {
        // If there's an open session, close it
        if (currentSession && !currentSession.endTime) {
          currentSession.endTime = event.timestamp;
          currentSession.status = 'Completed';
        }

        currentSession = {
          id: event.id,
          type: 'SESSION',
          startTime: event.timestamp,
          endTime: null,
          tickets: new Set<string>(),
          status: 'Active',
          breakMs: 0,
          pendingBreakStart: null,
        };
        sessions.push(currentSession);
      } else if (event.type === 'CLOCK_OUT') {
        if (currentSession) {
          currentSession.endTime = event.timestamp;
          currentSession.status = 'Completed';
          if (event.comment) {
            currentSession.comment = event.comment;
          }
          // We don't nullify currentSession immediately to allow for potential trailing events 
          // (though unlikely in normal flow), but effectively this session is done.
          currentSession = null;
        }
      } else if (event.type === 'START_TICKET' || event.type === 'STOP_TICKET') {
        if (!currentSession) {
          // If we encounter ticket activity without a session, create one
          currentSession = {
            id: event.id,
            type: 'SESSION',
            startTime: event.timestamp,
            endTime: null,
            tickets: new Set<string>(),
            status: 'Active',
            breakMs: 0,
            pendingBreakStart: null,
          };
          sessions.push(currentSession);
        }

        if (event.ticketTitle) {
          currentSession.tickets.add(event.ticketTitle);
        }

        if (event.comment) {
          currentSession.comment = event.comment;
        }
      } else if (event.type === 'BREAK_START') {
        if (currentSession) {
          currentSession.pendingBreakStart = new Date(event.timestamp).getTime();
        }
      } else if (event.type === 'BREAK_END') {
        if (currentSession && currentSession.pendingBreakStart != null) {
          currentSession.breakMs = (currentSession.breakMs || 0) +
            (new Date(event.timestamp).getTime() - currentSession.pendingBreakStart);
          currentSession.pendingBreakStart = null;
        }
      }
    }

    const activities = sessions.map(session => {
      const ticketList = Array.from(session.tickets as Set<string>);
      let subtitle = '';
      
      if (ticketList.length > 0) {
        // Limit to showing first 2 tickets and count for rest
        if (ticketList.length <= 2) {
          subtitle = `Worked on: ${ticketList.join(', ')}`;
        } else {
          subtitle = `Worked on: ${ticketList.slice(0, 2).join(', ')} +${ticketList.length - 2} more`;
        }
      } else {
        subtitle = session.status === 'Active' ? 'Session in progress' : 'No tickets recorded';
      }

      // Calculate duration — subtract accumulated break time
      const start = new Date(session.startTime);
      const end = session.endTime ? new Date(session.endTime) : new Date();
      // If session is still active and a break is ongoing, count that break up to now
      const ongoingBreakMs = session.pendingBreakStart != null
        ? end.getTime() - session.pendingBreakStart
        : 0;
      const durationMs = Math.max(0, end.getTime() - start.getTime() - (session.breakMs || 0) - ongoingBreakMs);

      const hours = Math.floor(durationMs / (1000 * 60 * 60));
      const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
      const duration = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

      return {
        id: session.id,
        type: 'SESSION',
        title: 'Work Session',
        subtitle,
        description: session.comment,
        startTime: session.startTime,
        endTime: session.endTime,
        status: session.status,
        duration,
        durationMs,
      };
    });

    // Return newest first
    const reversedActivities = activities.reverse();
    
    if (isAll) {
      res.json(reversedActivities);
    } else {
      res.json(reversedActivities.slice(0, limitNum));
    }

  } catch (error) {
    console.error('Error fetching recent activity:', error);
    res.status(500).json({ message: 'Error fetching recent activity' });
  }
};

export const getMemberActivity = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { memberId } = req.params;
    const { teamId } = req.query;

    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    if (!memberId) {
      res.status(400).json({ message: 'Member ID is required' });
      return;
    }

    // Verify the requesting user is a member of the team if teamId is provided
    if (teamId) {
      const membership = await Member.findOne({
        where: { userId, teamId: teamId as string }
      });

      if (!membership) {
        res.status(403).json({ message: 'You must be a member of the team to view activity' });
        return;
      }

      // Security Check: Only Leaders or the member themselves can view detailed activity
      if (membership.role !== 'Leader' && userId !== memberId) {
        res.status(403).json({ message: 'Insufficient permissions to view member activity' });
        return;
      }
    } else if (userId !== memberId) {
      // If no teamId provided, valid only if viewing own profile
      res.status(403).json({ message: 'Unauthorized to view this profile' }); 
      return;
    }

    // Get member profile
    const member = await User.findByPk(memberId);
    if (!member) {
      res.status(404).json({ message: 'Member not found' });
      return;
    }

    // Get member role in team if teamId provided
    let memberRole = 'Member';
    if (teamId) {
      const membership = await Member.findOne({
        where: { userId: memberId, teamId: teamId as string }
      });
      if (membership) {
        memberRole = membership.role;
      }
    }

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Helper to get time entries for a period
    const getTimeEntriesForPeriod = async (userId: string, startTime: Date, teamId?: string) => {
      const whereClause: any = {
        userId,
        timestamp: { [Op.gte]: startTime }
      };
      if (teamId) {
        whereClause.teamId = teamId;
      }

      return await WorkLog.findAll({
        where: whereClause,
        order: [['timestamp', 'ASC']]
      });
    };

    // Helper to get initial state before period
    const getInitialState = async (userId: string, beforeTime: Date, teamId?: string) => {
      const whereClause: any = {
        userId,
        timestamp: { [Op.lt]: beforeTime }
      };
      if (teamId) whereClause.teamId = teamId;
      
      const lastEvent = await WorkLog.findOne({
        where: whereClause,
        order: [['timestamp', 'DESC']],
      });
      
      if (!lastEvent) return false;
      return ['CLOCK_IN', 'START_TICKET', 'STOP_TICKET'].includes(lastEvent.type) && lastEvent.type !== 'CLOCK_OUT';
    };

    // Helper to calculate duration from events
    const calculateDuration = (events: any[], startTime: Date, initialState: boolean) => {
      let totalMs = 0;
      let currentTime = startTime.getTime();
      let isClockedIn = initialState;

      for (const event of events) {
        const eventTime = new Date(event.timestamp).getTime();
        
        // Safety check to ensure we don't calculate negative time if query returns older events
        if (eventTime < currentTime) continue;

        if (isClockedIn) {
          totalMs += (eventTime - currentTime);
        }

        currentTime = eventTime;

        switch (event.type) {
          case 'CLOCK_IN':
          case 'BREAK_END':
            isClockedIn = true;
            break;
          case 'CLOCK_OUT':
          case 'BREAK_START':
            isClockedIn = false;
            break;
          case 'START_TICKET':
            isClockedIn = true;
            break;
          case 'STOP_TICKET':
            isClockedIn = true;
            break;
        }
      }

      // If still clocked in, add time until now
      if (isClockedIn) {
        const nowMs = new Date().getTime();
        if (nowMs > currentTime) {
          totalMs += (nowMs - currentTime);
        }
      }

      return totalMs;
    };

    // Get today's entries
    const todayEntries = await getTimeEntriesForPeriod(memberId, startOfToday, teamId as string);
    const todayInitialState = await getInitialState(memberId, startOfToday, teamId as string);
    const todayDuration = calculateDuration(todayEntries, startOfToday, todayInitialState);
    
    // Get this week's entries
    const weekEntries = await getTimeEntriesForPeriod(memberId, startOfWeek, teamId as string);
    const weekInitialState = await getInitialState(memberId, startOfWeek, teamId as string);
    const weekDuration = calculateDuration(weekEntries, startOfWeek, weekInitialState);

    // Get this month's entries
    const monthEntries = await getTimeEntriesForPeriod(memberId, startOfMonth, teamId as string);
    const monthInitialState = await getInitialState(memberId, startOfMonth, teamId as string);
    const monthDuration = calculateDuration(monthEntries, startOfMonth, monthInitialState);

    // Format durations
    const formatDuration = (ms: number): string => {
      const hours = Math.floor(ms / (1000 * 60 * 60));
      const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
      return `${hours}h ${minutes}m`;
    };

    // Compute session work-ms by replaying raw events, excluding break time.
    const computeSessionMs = (events: any[]): number => {
      let ms = 0;
      let clockedIn = false;
      let lastTs = 0;
      for (const e of events) {
        const ts = new Date(e.timestamp).getTime();
        if (clockedIn && ts > lastTs) ms += ts - lastTs;
        lastTs = ts;
        switch (e.type) {
          case 'CLOCK_IN': case 'BREAK_END': case 'START_TICKET': case 'STOP_TICKET':
            clockedIn = true; break;
          case 'CLOCK_OUT': case 'BREAK_START':
            clockedIn = false; break;
        }
      }
      if (clockedIn && lastTs > 0) ms += Date.now() - lastTs;
      return ms;
    };

    // Get recent tickets worked on
    // Fetch last 50 to ensure coverage for unique tickets
    const recentEvents = await WorkLog.findAll({
      where: {
        userId: memberId,
        type: { [Op.in]: ['START_TICKET', 'STOP_TICKET'] },
        ticketTitle: { [Op.ne]: null },
        ...(teamId && { teamId: teamId as string })
      },
      attributes: ['ticketId', 'ticketTitle', 'timestamp'],
      order: [['timestamp', 'DESC']],
      limit: 50,
      raw: true
    });

    // Get unique tickets with their details
    const uniqueTickets = Array.from(
      new Map(recentEvents.map((t: any) => [t.ticketId, t])).values()
    ).slice(0, 5);

    // Get clock-in/clock-out times for today
    const todayClockEvents = todayEntries.filter((e: any) => 
      e.type === 'CLOCK_IN' || e.type === 'CLOCK_OUT'
    );

    const clockTimes = todayClockEvents.map((event: any) => ({
      type: event.type,
      timestamp: event.timestamp,
      time: new Date(event.timestamp).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      })
    }));

    // --- Pagination Logic for Work Sessions ---
    const { cursor, limit } = req.query;
    const limitNum = limit ? parseInt(limit as string) : 5;
    const cursorDate = cursor ? new Date(cursor as string) : new Date();

    // Fetch enough logs to construct at least 'limit' sessions
    // We assume ~20 events per session is a safe upper bound to fetch enough data
    const sessionLogs = await WorkLog.findAll({
      where: {
        userId: memberId,
        timestamp: { [Op.lt]: cursorDate },
        ...(teamId && { teamId: teamId as string })
      },
      // Removed include to avoid potential association errors, will fetch tickets manually
      order: [['timestamp', 'DESC']],
      limit: limitNum * 20 
    });

    // Fetch related tickets manually to ensure we have details for references
    const ticketIds = new Set<string>();
    sessionLogs.forEach(log => {
        if (log.ticketId) ticketIds.add(log.ticketId);
    });
    
    const relatedTicketsMap = new Map();
    if (ticketIds.size > 0) {
        const relatedTickets = await Ticket.findAll({
            where: { id: Array.from(ticketIds) }
        });
        relatedTickets.forEach(t => relatedTicketsMap.set(t.id, t));
    }

    // Fetch related replies
    const workLogIds = sessionLogs.map(log => log.id);
    const relatedReplies = await WorkLogReply.findAll({
        where: { workLogId: workLogIds },
        include: [{ 
            model: User, 
            as: 'user',
            attributes: ['id', 'full_name', 'email']
        }],
        order: [['createdAt', 'ASC']]
    });
    
    const repliesMap = new Map();
    relatedReplies.forEach(r => {
        if (!repliesMap.has(r.workLogId)) repliesMap.set(r.workLogId, []);
        repliesMap.get(r.workLogId).push(r.get({plain: true})); 
    });

    // Group logs into sessions (Newest First)
    const sessions: any[] = [];
    let currentSession: any = null;

    // Process logs (chronological for grouping logic, so reverse first)
    // Convert to plain objects to attach ticket data freely and avoid circular dependencies in Sequelize instances
    const chronoSessionsLogs = sessionLogs.map(log => {
        const plainLog = log.get({ plain: true }) as any;
        if (plainLog.ticketId && relatedTicketsMap.has(plainLog.ticketId)) {
            plainLog.ticket = relatedTicketsMap.get(plainLog.ticketId)?.get({ plain: true });
        }
        if (repliesMap.has(plainLog.id)) {
            plainLog.replies = repliesMap.get(plainLog.id);
        }
        return plainLog;
    }).reverse();

    for (const event of chronoSessionsLogs) {
      // event is now a plain object
      
      if (event.type === 'CLOCK_IN') {
        // Start of a session (or end of "Active" session if processing reversed)
        // With DESC logs reversed -> Chronological (Oldest -> Newest)
        
        // If we have an open session, this CLOCK_IN is its start.
        // Wait, currentSession logic in getRecentActivity loop:
        /*
          if (CLOCK_IN) {
             if (currentSession && !currentSession.endTime) { currentSession.endTime = event.timestamp ... } // Wait, CLOCK_IN ends a session? No. 
             // In getRecentActivity logic above:
             // if (CLOCK_IN) -> close current (if open??) -> start NEW session.
        */
       
       // Let's re-verify getRecentActivity logic.
       // It seems to assume CLOCK_IN starts a NEW session.
       // If there was a previous session pending? It closes it?
       // Actually, let's use the robust logic from MemberPageClient but on backend.
       
       // MemberPageClient Logic (Ascending):
       // CLOCK_IN -> New Session.
       // CLOCK_OUT -> End Current Session.
       
       if (currentSession && !currentSession.endTime) {
          // We have an active session, and we hit another CLOCK_IN?
          // This implies the previous one was never clocked out. 
          // Auto-close it? Or just leave it active?
          // For now, let's just start a new one.
          sessions.push(currentSession);
       }
       
       currentSession = {
          id: `session-${event.id}`,
          startTime: event.timestamp,
          endTime: null,
          events: [event],
          status: 'active'
       };
       
      } else if (event.type === 'CLOCK_OUT') {
         if (currentSession) {
             currentSession.endTime = event.timestamp;
             currentSession.status = 'completed';
             currentSession.events.push(event);
             sessions.push(currentSession);
             currentSession = null;
         } else {
             // Orphaned Clock Out? Ignore or create adhoc?
         }
      } else {
         // Ticket or Ticket Start/Stop
         if (currentSession) {
             currentSession.events.push(event);
         } else {
             // Event outside session - maybe create adhoc session?
             // Or attach to a "Miscellaneous" session?
             // For now, let's ignore or create a temp session if critical.
             // Given the requirements, let's be lenient.
             /*
             currentSession = {
                id: `adhoc-${event.id}`,
                startTime: event.timestamp,
                endTime: event.timestamp, // single point?
                events: [event],
                status: 'adhoc'
             };
             sessions.push(currentSession);
             currentSession = null;
             */
             // Actually, grouping tickets to "Sessions" requires a CLOCK_IN usually.
             // If we don't have one, we can just group by similarity or time proximity? 
             // Let's skip for now to match frontend logic which requires CLOCK_IN.
         }
      }
    }
    
    // If we have a lingering currentSession (Active), push it
    if (currentSession) {
        sessions.push(currentSession);
    }

    // Now sessions are Ascending. Reverse to get Newest First.
    const reversedSessions = sessions.reverse();
    
    // Slice to limit
    const paginatedSessions = reversedSessions.slice(0, limitNum);

    // Map to simplified structure for frontend
    const formattedSessions = paginatedSessions.map(session => {
        const sessionDurationMs = computeSessionMs(session.events);
        const groupedEvents: any[] = [];
        let pendingTicket: any = null;

        const flushPendingTicket = (forceEndTimestamp?: Date) => {
             if (pendingTicket) {
                 let durationStr = '';
                 const startTime = new Date(pendingTicket.startTime);
                 
                 let endTime = pendingTicket.endTime ? new Date(pendingTicket.endTime) : null;
                 
                 if (endTime) {
                     const diff = endTime.getTime() - startTime.getTime();
                     const minutes = Math.floor(diff / 60000);
                     if (minutes < 1) durationStr = '< 1m';
                     else if (minutes < 60) durationStr = `${minutes}m`;
                     else {
                         const h = Math.floor(minutes / 60);
                         const m = minutes % 60;
                         durationStr = `${h}h ${m}m`;
                     }
                 } else {
                     durationStr = startTime.toLocaleTimeString('en-US', {hour: 'numeric', minute:'2-digit', hour12: true});
                 }

                 // Extract detailed ticket info
                 const originalTicket = pendingTicket.originalStart.ticket;
                 const references = [];
                 if (originalTicket && originalTicket.link) {
                     references.push({ type: 'link', url: originalTicket.link, label: 'External Link' });
                 }

                 groupedEvents.push({
                     id: pendingTicket.startId, 
                     type: 'TICKET',
                     title: pendingTicket.ticketTitle || 'Ticket Work',
                     timestamp: pendingTicket.startTime,
                     endTimestamp: pendingTicket.endTime || null,
                     references,
                     original: {
                         ...pendingTicket.originalStart,
                         comment: pendingTicket.comment, 
                     },
                     timeFormatted: durationStr,
                     startTimeFormatted: startTime.toLocaleTimeString('en-US', {hour: 'numeric', minute:'2-digit', hour12: true}),
                     endTimeFormatted: endTime ? endTime.toLocaleTimeString('en-US', {hour: 'numeric', minute:'2-digit', hour12: true}) : undefined
                 });
                 pendingTicket = null;
             }
        };

        // Current session events are already chronological (CLOCK_IN -> ... -> CLOCK_OUT)
        session.events.forEach((e: any) => {
            if (e.type === 'CLOCK_IN' || e.type === 'CLOCK_OUT') {
                flushPendingTicket();
                groupedEvents.push({
                    id: e.id,
                    type: 'CLOCK',
                    title: e.type === 'CLOCK_IN' ? 'Clocked In' : 'Clocked Out',
                    timestamp: e.timestamp,
                    original: e,
                    timeFormatted: new Date(e.timestamp).toLocaleTimeString('en-US', {hour: 'numeric', minute:'2-digit', hour12: true})
                });
            } else if (e.type === 'START_TICKET') {
                flushPendingTicket(e.timestamp); // force flush previous ticket
                pendingTicket = {
                    startId: e.id,
                    startTime: e.timestamp,
                    ticketTitle: e.ticketTitle,
                    originalStart: e,
                    comment: e.comment 
                };
            } else if (e.type === 'STOP_TICKET') {
                if (pendingTicket) {
                    if (!pendingTicket.ticketTitle && e.ticketTitle) pendingTicket.ticketTitle = e.ticketTitle;
                    pendingTicket.endTime = e.timestamp;
                    if (e.comment) pendingTicket.comment = e.comment; 
                    flushPendingTicket();
                } else {
                    // Orphaned stop
                     groupedEvents.push({
                         id: e.id,
                         type: 'TICKET',
                         title: e.ticketTitle || 'Ticket Work',
                         timestamp: e.timestamp,
                         original: e,
                         timeFormatted: new Date(e.timestamp).toLocaleTimeString('en-US', {hour: 'numeric', minute:'2-digit', hour12: true})
                     });
                }
            } else if (e.type === 'BREAK_START' || e.type === 'BREAK_END') {
                 flushPendingTicket();
                 groupedEvents.push({
                     id: e.id,
                     type: 'CLOCK',
                     title: e.type === 'BREAK_START' ? 'Break Started' : 'Break Ended',
                     timestamp: e.timestamp,
                     original: { ...e, type: e.type },
                     timeFormatted: new Date(e.timestamp).toLocaleTimeString('en-US', {hour: 'numeric', minute:'2-digit', hour12: true})
                 });
            } else {
                 flushPendingTicket();
                 groupedEvents.push({
                     id: e.id,
                     type: 'UNKNOWN',
                     title: 'Unknown Event',
                     timestamp: e.timestamp,
                     original: e,
                     timeFormatted: ''
                 });
            }
        });
        flushPendingTicket();

        // Merge ticket events with the same ticketId into one container
        const mergedEvents: any[] = [];
        const ticketIndexMap = new Map<string, number>();

        for (const evt of groupedEvents) {
            if (evt.type === 'TICKET' && evt.original?.ticketId) {
                const tid = evt.original.ticketId;
                if (ticketIndexMap.has(tid)) {
                    const idx = ticketIndexMap.get(tid)!;
                    const existing = mergedEvents[idx];
                    // Update end time to latest
                    if (evt.endTimestamp) {
                        existing.endTimestamp = evt.endTimestamp;
                        existing.endTimeFormatted = evt.endTimeFormatted;
                    }
                    // Accumulate comments
                    if (evt.original.comment) {
                        const prev = existing.original.comment || '';
                        existing.original.comment = prev ? `${prev}\n${evt.original.comment}` : evt.original.comment;
                    }
                    // Merge replies
                    if (evt.original.replies?.length) {
                        existing.original.replies = [...(existing.original.replies || []), ...evt.original.replies];
                    }
                    // Recalculate duration
                    const startMs = new Date(existing.timestamp).getTime();
                    const endMs = existing.endTimestamp ? new Date(existing.endTimestamp).getTime() : null;
                    if (endMs) {
                        const diff = endMs - startMs;
                        const minutes = Math.floor(diff / 60000);
                        if (minutes < 1) existing.timeFormatted = '< 1m';
                        else if (minutes < 60) existing.timeFormatted = `${minutes}m`;
                        else {
                            const h = Math.floor(minutes / 60);
                            const m = minutes % 60;
                            existing.timeFormatted = `${h}h ${m}m`;
                        }
                    }
                } else {
                    ticketIndexMap.set(tid, mergedEvents.length);
                    mergedEvents.push(evt);
                }
            } else {
                mergedEvents.push(evt);
            }
        }

        return {
            ...session,
            durationMs: sessionDurationMs,
            events: mergedEvents
        };
    });

    res.json({
      member: {
        id: member.id,
        name: member.full_name || member.email,
        email: member.email,
        role: memberRole,
        status: member.status || 'offline'
      },
      timeTracking: {
        today: {
            duration: formatDuration(todayDuration),
            totalMs: todayDuration,
            clockEvents: clockTimes
        },
        week: {
            duration: formatDuration(weekDuration),
            totalMs: weekDuration,
        },
        month: {
            duration: formatDuration(monthDuration),
            totalMs: monthDuration,
        }
      },
      recentTickets: uniqueTickets.map((ticket: any) => ({
        id: ticket.ticketId,
        title: ticket.ticketTitle,
        lastWorkedOn: ticket.timestamp
      })),
      sessions: formattedSessions
    });

  } catch (error) {
    console.error('Error fetching member activity:', error);
    res.status(500).json({ message: 'Error fetching member activity' });
  }
};

// ---------------------------------------------------------------------------
// Timesheet totals — per-day totalMs from UserDailyStat for a date range.
// Returns raw milliseconds so the frontend (Luxon) handles formatting.
// ---------------------------------------------------------------------------
export const getTimesheetTotals = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) { res.status(401).json({ message: 'Unauthorized' }); return; }

    const { from, to, teamId, memberId } = req.query;
    if (!from || !to) { res.status(400).json({ message: 'from and to query params are required' }); return; }

    // Determine whose data to return. Defaults to the authenticated user.
    let targetUserId = userId;
    if (memberId && memberId !== userId) {
      // Viewing another member — require team context + Leader role
      if (!teamId) { res.status(400).json({ message: 'teamId is required when querying another member' }); return; }
      const membership = await Member.findOne({ where: { userId, teamId: teamId as string } });
      if (!membership || membership.role !== 'Leader') {
        res.status(403).json({ message: 'Insufficient permissions' }); return;
      }
      targetUserId = memberId as string;
    }

    const whereClause: any = {
      userId: targetUserId,
      date: { [Op.between]: [from as string, to as string] },
    };
    if (teamId) whereClause.teamId = teamId as string;

    const rows = await UserDailyStat.findAll({
      where: whereClause,
      attributes: ['date', 'totalMs'],
      order: [['date', 'ASC']],
    });

    const totalsMap = new Map<string, number>();
    rows.forEach(r => totalsMap.set(r.date, Number(r.totalMs)));

    // If today is in the requested range, inject live session time (same logic as getDashboardStats)
    const now = new Date();
    const localDate = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const today = localDate(now);

    if (today >= (from as string) && today <= (to as string)) {
      const lastClockEventWhere: any = { userId: targetUserId, type: { [Op.in]: ['CLOCK_IN', 'CLOCK_OUT'] } };
      if (teamId) lastClockEventWhere.teamId = teamId as string;

      const lastClockEvent = await WorkLog.findOne({
        where: lastClockEventWhere,
        order: [['timestamp', 'DESC']],
        attributes: ['type', 'timestamp'],
      });

      if (lastClockEvent?.type === 'CLOCK_IN') {
        const sessionStartMs = new Date(lastClockEvent.timestamp).getTime();
        const breakEventsWhere: any = {
          userId: targetUserId,
          type: { [Op.in]: ['BREAK_START', 'BREAK_END'] },
          timestamp: { [Op.gte]: lastClockEvent.timestamp },
        };
        if (teamId) breakEventsWhere.teamId = teamId as string;

        const breakEvents = await WorkLog.findAll({
          where: breakEventsWhere,
          order: [['timestamp', 'ASC']],
          attributes: ['type', 'timestamp'],
        });

        let totalBreakMs = 0;
        let breakSegStart: number | null = null;
        for (const be of breakEvents) {
          if (be.type === 'BREAK_START') breakSegStart = new Date(be.timestamp).getTime();
          else if (be.type === 'BREAK_END' && breakSegStart !== null) {
            totalBreakMs += new Date(be.timestamp).getTime() - breakSegStart;
            breakSegStart = null;
          }
        }
        if (breakSegStart !== null) totalBreakMs += now.getTime() - breakSegStart;

        const liveMs = Math.max(0, now.getTime() - sessionStartMs - totalBreakMs);
        if (liveMs > 0) {
          totalsMap.set(today, (totalsMap.get(today) || 0) + liveMs);
        }
      }
    }

    const result = Array.from(totalsMap.entries()).map(([date, totalMs]) => ({ date, totalMs }));
    res.json(result);
  } catch (error) {
    console.error('Error fetching timesheet totals:', error);
    res.status(500).json({ message: 'Error fetching timesheet totals' });
  }
};

// Add a reply to a work log
export const addReply = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { message, workLogId, recipientId } = req.body;

    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    if (!message || !workLogId) {
      res.status(400).json({ message: 'Message and WorkLog ID are required' });
      return;
    }

    // Check if work log exists
    const workLog = await WorkLog.findByPk(workLogId, {
      include: [{ model: User, as: 'user' }]
    });

    if (!workLog) {
      res.status(404).json({ message: 'Work log not found' });
      return;
    }

    // Create the reply
    const reply = await WorkLogReply.create({
      userId,
      workLogId,
      content: message
    });

    // Send notification if commenting on someone else's log
    if (workLog.userId !== userId) {
      const sender = await User.findByPk(userId);
      const senderName = sender?.full_name || 'Team Leader';
      
      const notificationTitle = `New Reply from ${senderName}`;
      const notificationBody = message;
      
      try {
        await sendNotificationToUser(workLog.userId, {
          title: notificationTitle,
          body: notificationBody,
          data: {
            type: 'reply',
            workLogId: workLog.id,
            replyId: reply.id,
            senderId: userId
          }
        });
      } catch (notifError) {
        console.error('Failed to send push notification:', notifError);
      }
    }

    // Return the created reply with user info
    const replyWithUser = await WorkLogReply.findByPk(reply.id, {
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'full_name', 'email']
      }]
    });

    res.status(201).json(replyWithUser);
  } catch (error) {
    console.error('Error adding reply:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
