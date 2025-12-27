import { Response } from 'express';
import { Team, Member } from '../models';
import { AuthRequest } from '../middleware/authMiddleware';
import logger from '../utils/logger';
import User from '../models/User';
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

    // Also add the creator as a Leader in the members table
    await Member.create({
      userId,
      teamId: team.id,
      role: 'Leader'
    });

    res.status(201).json(team);
  } catch (error) {
    logger.error('Error creating team:', error);
    res.status(500).json({ error: 'Failed to create team' });
  }
};

export const joinTeam = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { code } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    if (!code) {
      res.status(400).json({ error: 'Team code is required' });
      return;
    }

    // Find the team
    const team = await Team.findOne({ where: { code } });
    if (!team) {
      res.status(404).json({ error: 'Team not found' });
      return;
    }

    // Check if already a member
    const existingMember = await Member.findOne({
      where: {
        userId,
        teamId: team.id
      }
    });

    if (existingMember) {
      res.status(409).json({ error: 'You are already a member of this team' });
      return;
    }

    // Create member record
    await Member.create({
      userId,
      teamId: team.id,
      role: 'Member'
    });

    logger.info(`User ${userId} joined team ${team.id}`);

    res.status(200).json(team);
  } catch (error) {
    logger.error('Error joining team:', error);
    res.status(500).json({ error: 'Failed to join team' });
  }
};

export const getMyTeams = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    // Find all teams where the user is a member
    const userMemberships = await Member.findAll({
      where: { userId },
      include: [
        {
          model: Team,
          as: 'team',
          include: [
            {
              model: Member,
              as: 'members',
              include: [
                {
                  model: User,
                  as: 'user',
                  attributes: ['id', 'full_name', 'status']
                }
              ]
            }
          ]
        }
      ]
    });

    // Format the response
    const teams = userMemberships.map(membership => {
      const team = (membership as any).team;
      return {
        id: team.id,
        name: team.name,
        code: team.code,
        role: membership.role,
        members: team.members.map((m: any) => ({
          id: m.user.id,
          name: m.user.full_name || 'Unknown User',
          status: m.user.status,
          role: m.role,
          avatar: undefined // Add avatar logic if needed
        }))
      };
    });

    res.status(200).json(teams);
  } catch (error) {
    logger.error('Error fetching user teams:', error);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
};
