
import { Response } from 'express';
import { Op } from 'sequelize';
import { AuthRequest } from '../middleware/authMiddleware';
import { Ticket, Member, Team, WorkLog } from '../models';
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
    const { teamId } = req.query;

    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    // Fetch recent work logs (events)
    const eventsWhereClause: any = { userId };
    if (teamId) {
      eventsWhereClause.teamId = teamId;
    }

    const events = await WorkLog.findAll({
      where: eventsWhereClause,
      order: [['timestamp', 'DESC']],
      limit: 20
    });

    const activities = events.map((event) => {
      let title = '';
      let subtitle = '';
      let status = 'Completed';

      switch (event.type) {
        case 'CLOCK_IN':
          title = 'Clocked In';
          subtitle = 'Started session';
          break;
        case 'CLOCK_OUT':
          title = 'Clocked Out';
          subtitle = event.comment || 'Ended session';
          break;
        case 'START_TICKET':
          title = event.ticketTitle || 'Started Ticket';
          subtitle = 'Started working on ticket';
          status = 'Active';
          break;
        case 'STOP_TICKET':
          title = event.ticketTitle || 'Stopped Ticket';
          subtitle = event.comment || 'Stopped working on ticket';
          break;
        default:
          title = 'Unknown Event';
      }

      // Filter by teamId if needed (though events might not have teamId directly, 
      // we'd need to join with Ticket if we want to be strict, but for now we show all user activity)
      // If strict team filtering is required, we would need to fetch Ticket info.
      
      return {
        id: event.id,
        type: event.type,
        title,
        subtitle,
        startTime: event.timestamp,
        endTime: null, // Events are point-in-time
        status,
        duration: '' // Duration is not applicable for single events
      };
    });

    res.json(activities);

  } catch (error) {
    console.error('Error fetching recent activity:', error);
    res.status(500).json({ message: 'Error fetching recent activity' });
  }
};
