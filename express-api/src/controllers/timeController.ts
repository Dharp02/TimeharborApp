import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import { Attendance, WorkLog } from '../models';
import sequelize from '../config/sequelize';
import logger from '../utils/logger';

export const syncTimeData = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const { attendance = [], workLogs = [] } = req.body;

  const transaction = await sequelize.transaction();

  try {
    // Process Attendance
    for (const entry of attendance) {
      const { id, clockIn, clockOut } = entry;
      
      // Basic validation
      if (clockOut && new Date(clockOut) < new Date(clockIn)) {
        throw new Error(`Invalid time range for attendance ${id}: clockOut cannot be before clockIn`);
      }

      const existing = await Attendance.findOne({ 
        where: { id, userId }, 
        transaction 
      });

      if (existing) {
        await existing.update({ clockIn, clockOut }, { transaction });
      } else {
        await Attendance.create({
          id,
          userId,
          clockIn,
          clockOut
        }, { transaction });
      }
    }

    // Process WorkLogs
    for (const log of workLogs) {
      const { id, ticketId, attendanceId, startTime, endTime, description } = log;

      // Basic validation
      if (endTime && new Date(endTime) < new Date(startTime)) {
        throw new Error(`Invalid time range for workLog ${id}: endTime cannot be before startTime`);
      }

      const existing = await WorkLog.findOne({ 
        where: { id, userId }, 
        transaction 
      });

      if (existing) {
        await existing.update({ 
          ticketId, 
          attendanceId, 
          startTime, 
          endTime, 
          description 
        }, { transaction });
      } else {
        await WorkLog.create({
          id,
          userId,
          ticketId,
          attendanceId,
          startTime,
          endTime,
          description
        }, { transaction });
      }
    }

    await transaction.commit();
    
    res.status(200).json({ message: 'Time data synced successfully' });
  } catch (error) {
    await transaction.rollback();
    logger.error('Error syncing time data:', error);
    res.status(500).json({ message: 'Error syncing time data', error: (error as Error).message });
  }
};
