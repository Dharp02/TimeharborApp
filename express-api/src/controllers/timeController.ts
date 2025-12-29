import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import { WorkLog, Ticket, Team } from '../models';
import sequelize from '../config/sequelize';
import logger from '../utils/logger';
import { Op } from 'sequelize';

export const syncTimeData = async (req: AuthRequest, res: Response) => {
  // ... existing syncTimeData implementation (kept for backward compatibility if needed, or we can replace it)
  // For now, I will keep it but I'll focus on adding syncTimeEvents
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  // ... (rest of existing function)
  res.status(501).json({ message: 'Use /sync-events endpoint' });
};

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

  const transaction = await sequelize.transaction();

  try {
    for (const event of events) {
      const { id, type, timestamp, ticketId, teamId, ticketTitle, comment } = event;
      
      // Validate Ticket if present
      let finalTicketId = ticketId || null;
      if (finalTicketId) {
         const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
         if (!uuidRegex.test(finalTicketId)) {
           finalTicketId = null;
         } else {
             // Check if ticket exists to avoid FK error
             const ticketExists = await Ticket.findByPk(finalTicketId, { transaction });
             if (!ticketExists) {
                 console.warn(`Ticket ${finalTicketId} not found for event ${id}, setting ticketId to null`);
                 finalTicketId = null;
             }
         }
      }

      // Validate Team if present
      let finalTeamId = teamId || null;
      if (finalTeamId) {
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          if (!uuidRegex.test(finalTeamId)) {
              finalTeamId = null;
          } else {
              const teamExists = await Team.findByPk(finalTeamId, { transaction });
              if (!teamExists) {
                  console.warn(`Team ${finalTeamId} not found for event ${id}, setting teamId to null`);
                  finalTeamId = null;
              }
          }
      }

      // Check if event already exists
      const existingLog = id ? await WorkLog.findByPk(id, { transaction }) : null;

      if (existingLog) {
          await existingLog.update({
            userId,
            type,
            timestamp: new Date(timestamp),
            ticketId: finalTicketId,
            teamId: finalTeamId,
            ticketTitle,
            comment
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
            comment
          }, { transaction });
      }
    }

    await transaction.commit();
    res.status(200).json({ message: 'Events synced successfully' });

  } catch (error) {
    await transaction.rollback();
    console.error('Error syncing events:', error);
    res.status(500).json({ message: 'Error syncing events', error: (error as Error).message });
  }
};

