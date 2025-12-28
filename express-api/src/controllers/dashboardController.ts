
import { Response } from 'express';
import { Op } from 'sequelize';
import { AuthRequest } from '../middleware/authMiddleware';
import { Attendance, Ticket, Member, Team, WorkLog } from '../models';
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

    // 1. Total Hours Today
    // "summation first clock in for the day to last clock out for the day"
    // Implementation: We will fetch all attendance records for today and sum the durations.
    // If a record has no clockOut, we use 'now' for calculation (or ignore it? usually 'now' for live tracking).
    // However, the prompt says "first clock in ... to last clock out". 
    // If the user insists on "Span of day", it would be (Max(clockOut) - Min(clockIn)).
    // But "Total Hours" usually means worked hours. I will stick to Sum(Duration).
    
    const todayAttendance = await Attendance.findAll({
      where: {
        userId,
        clockIn: {
          [Op.gte]: startOfToday
        }
      }
    });

    let totalMillisecondsToday = 0;
    todayAttendance.forEach(record => {
      const start = new Date(record.clockIn).getTime();
      const end = record.clockOut ? new Date(record.clockOut).getTime() : now.getTime();
      totalMillisecondsToday += (end - start);
    });

    const totalHoursToday = Math.floor(totalMillisecondsToday / (1000 * 60 * 60));
    const totalMinutesToday = Math.floor((totalMillisecondsToday % (1000 * 60 * 60)) / (1000 * 60));


    // 2. Total Hours This Week
    const weekAttendance = await Attendance.findAll({
      where: {
        userId,
        clockIn: {
          [Op.gte]: startOfWeek
        }
      }
    });

    let totalMillisecondsWeek = 0;
    weekAttendance.forEach(record => {
      const start = new Date(record.clockIn).getTime();
      const end = record.clockOut ? new Date(record.clockOut).getTime() : now.getTime();
      totalMillisecondsWeek += (end - start);
    });

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

    // Fetch recent attendance sessions with their work logs
    const sessions = await Attendance.findAll({
      where: { userId },
      include: [
        {
          model: WorkLog,
          as: 'workLogs',
          include: [
            {
              model: Ticket,
              as: 'ticket',
              attributes: ['title', 'teamId'],
              include: [
                {
                  model: Team,
                  as: 'team',
                  attributes: ['name']
                }
              ]
            }
          ]
        }
      ],
      order: [['clockIn', 'DESC']],
      limit: 5
    });

    const activities: any[] = sessions.map((session: any) => {
      const workLogs = session.workLogs || [];
      
      // Filter tickets if teamId is provided
      const relevantLogs = teamId 
        ? workLogs.filter((log: any) => log.ticket?.teamId === teamId)
        : workLogs;

      // Get unique ticket titles
      const ticketTitles = Array.from(new Set(relevantLogs.map((log: any) => log.ticket?.title).filter(Boolean)));
      
      let subtitle = 'No recorded tasks';
      if (ticketTitles.length > 0) {
        subtitle = `Worked on: ${ticketTitles.join(', ')}`;
      } else if (workLogs.length > 0 && teamId) {
        // If there are logs but none for this team
        subtitle = 'Worked on tasks for other teams';
      }

      const now = new Date();
      const start = new Date(session.clockIn).getTime();
      const end = session.clockOut ? new Date(session.clockOut).getTime() : now.getTime();
      const durationMs = end - start;

      // Format duration
      const hours = Math.floor(durationMs / (1000 * 60 * 60));
      const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((durationMs % (1000 * 60)) / 1000);
      const durationStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

      return {
        id: session.id,
        type: 'SESSION',
        title: 'Work Session',
        subtitle: subtitle,
        startTime: session.clockIn,
        endTime: session.clockOut,
        status: session.clockOut ? 'Completed' : 'Active',
        duration: durationStr
      };
    });

    res.json(activities);

  } catch (error) {
    console.error('Error fetching recent activity:', error);
    res.status(500).json({ message: 'Error fetching recent activity' });
  }
};
