
import { Response } from 'express';
import { Op } from 'sequelize';
import { AuthRequest } from '../middleware/authMiddleware';
import { Ticket, Member, Team, WorkLog, User } from '../models';
import sequelize from '../config/sequelize';

export const getDashboardStats = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { teamId } = req.query;

    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Calculate start of week (assuming Sunday is 0)
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay());

    // Helper to calculate duration
    const getDurationForPeriod = async (userId: string, startTime: Date, teamId?: string) => {
       const whereClause: any = {
         userId,
         timestamp: { [Op.lt]: startTime }
       };
       if (teamId) {
         whereClause.teamId = teamId;
       }

       // Get last event before period to determine initial state
       const lastEvent = await WorkLog.findOne({
         where: whereClause,
         order: [['timestamp', 'DESC']]
       });

       const eventsWhereClause: any = {
         userId,
         timestamp: { [Op.gte]: startTime }
       };
       if (teamId) {
         eventsWhereClause.teamId = teamId;
       }

       // Get events in period
       const events = await WorkLog.findAll({
         where: eventsWhereClause,
         order: [['timestamp', 'ASC']]
       });

       let totalMs = 0;
       let currentTime = startTime.getTime();
       let isClockedIn = false;

       // Determine initial state
       if (lastEvent) {
         if (lastEvent.type === 'CLOCK_IN' || lastEvent.type === 'START_TICKET' || lastEvent.type === 'STOP_TICKET') {
            // If last event was NOT CLOCK_OUT, we are clocked in
            isClockedIn = true;
         }
         // If last event was CLOCK_OUT, isClockedIn remains false
       }

       for (const event of events) {
         const eventTime = new Date(event.timestamp).getTime();
         
         if (isClockedIn) {
           totalMs += (eventTime - currentTime);
         }

         currentTime = eventTime;

         switch (event.type) {
           case 'CLOCK_IN':
             isClockedIn = true;
             break;
           case 'CLOCK_OUT':
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

    // 1. Total Hours Today
    const totalMillisecondsToday = await getDurationForPeriod(userId, startOfToday, teamId as string);
    const totalHoursToday = Math.floor(totalMillisecondsToday / (1000 * 60 * 60));
    const totalMinutesToday = Math.floor((totalMillisecondsToday % (1000 * 60 * 60)) / (1000 * 60));

    // 2. Total Hours This Week
    const totalMillisecondsWeek = await getDurationForPeriod(userId, startOfWeek, teamId as string);
    const totalHoursWeek = Math.floor(totalMillisecondsWeek / (1000 * 60 * 60));
    const totalMinutesWeek = Math.floor((totalMillisecondsWeek % (1000 * 60 * 60)) / (1000 * 60));

    // 3. Open Tickets Assigned
    const ticketWhereClause: any = {
      assignedTo: userId,
      status: {
        [Op.ne]: 'Closed'
      }
    };

    if (teamId) {
      ticketWhereClause.teamId = teamId;
    }

    const openTicketsCount = await Ticket.count({
      where: ticketWhereClause
    });

    // 4. Team Members
    let teamMembersCount = 0;
    if (teamId) {
      teamMembersCount = await Member.count({
        where: {
          teamId: teamId as string
        }
      });
    }

    res.json({
      totalHoursToday: `${totalHoursToday}h ${totalMinutesToday}m`,
      totalHoursWeek: `${totalHoursWeek}h ${totalMinutesWeek}m`,
      openTickets: openTicketsCount,
      teamMembers: teamMembersCount
    });

  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ message: 'Error fetching dashboard stats' });
  }
};

export const getRecentActivity = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { teamId, limit } = req.query;

    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

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
          status: 'Active'
        };
        sessions.push(currentSession);
      } else if (event.type === 'CLOCK_OUT') {
        if (currentSession) {
          currentSession.endTime = event.timestamp;
          currentSession.status = 'Completed';
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
            status: 'Active'
          };
          sessions.push(currentSession);
        }

        if (event.ticketTitle) {
          currentSession.tickets.add(event.ticketTitle);
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

      // Calculate duration
      let duration = '';
      const start = new Date(session.startTime);
      const end = session.endTime ? new Date(session.endTime) : new Date();
      const diffMs = end.getTime() - start.getTime();
      
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      
      if (hours > 0) {
        duration = `${hours}h ${minutes}m`;
      } else {
        duration = `${minutes}m`;
      }

      return {
        id: session.id,
        type: 'SESSION',
        title: 'Work Session',
        subtitle,
        startTime: session.startTime,
        endTime: session.endTime,
        status: session.status,
        duration
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
            isClockedIn = true;
            break;
          case 'CLOCK_OUT':
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

    // Format durations
    const formatDuration = (ms: number): string => {
      const hours = Math.floor(ms / (1000 * 60 * 60));
      const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
      return `${hours}h ${minutes}m`;
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

        return {
            ...session,
            events: groupedEvents
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
          clockEvents: clockTimes
        },
        week: {
          duration: formatDuration(weekDuration)
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
