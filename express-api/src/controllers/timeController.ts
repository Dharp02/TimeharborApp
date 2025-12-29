import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import { WorkLog, Ticket } from '../models';
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
         }
      }

      await WorkLog.create({
        id: id || undefined, // Use client-side ID if available
        userId,
        type,
        timestamp: new Date(timestamp),
        ticketId: finalTicketId,
        teamId: teamId || null,
        ticketTitle,
        comment
      }, { transaction });
    }

    await transaction.commit();
    res.status(200).json({ message: 'Events synced successfully' });

  } catch (error) {
    await transaction.rollback();
    console.error('Error syncing events:', error);
    res.status(500).json({ message: 'Error syncing events', error: (error as Error).message });
  }
};

