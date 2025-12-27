import { Response } from 'express';
import { Team } from '../models';
import { AuthRequest } from '../middleware/authMiddleware';
import logger from '../utils/logger';

export const createTeam = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id, name, code, createdAt } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    if (!name || !code) {
      res.status(400).json({ error: 'Name and code are required' });
      return;
    }

    // Check if team with same code exists
    const existingTeam = await Team.findOne({ where: { code } });
    if (existingTeam) {
      res.status(409).json({ error: 'Team with this code already exists' });
      return;
    }

    const team = await Team.create({
      id: id || undefined, // Use provided ID if available (for syncing), otherwise auto-generate
      name,
      code,
      userId,
      createdAt: createdAt ? new Date(createdAt) : undefined
    });

    logger.info(`Team created: ${team.id} by user ${userId}`);

    res.status(201).json(team);
  } catch (error) {
    logger.error('Error creating team:', error);
    res.status(500).json({ error: 'Failed to create team' });
  }
};
