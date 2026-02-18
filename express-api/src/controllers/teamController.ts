import { Response } from 'express';
import { Team, Member, WorkLog, Ticket } from '../models';
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

export const updateTeam = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    if (!name) {
      res.status(400).json({ error: 'Team name is required' });
      return;
    }

    // Check if user is a leader of the team
    const membership = await Member.findOne({
      where: { userId, teamId: id, role: 'Leader' }
    });

    if (!membership) {
      res.status(403).json({ error: 'Not authorized to update this team' });
      return;
    }

    const team = await Team.findByPk(id);
    if (!team) {
      res.status(404).json({ error: 'Team not found' });
      return;
    }

    team.name = name;
    await team.save();

    res.status(200).json(team);
  } catch (error) {
    logger.error('Error updating team:', error);
    res.status(500).json({ error: 'Failed to update team' });
  }
};

export const deleteTeam = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    // Check if user is a leader of the team
    const membership = await Member.findOne({
      where: { userId, teamId: id, role: 'Leader' }
    });

    if (!membership) {
      res.status(403).json({ error: 'Not authorized to delete this team' });
      return;
    }

    const team = await Team.findByPk(id);
    if (!team) {
      res.status(404).json({ error: 'Team not found' });
      return;
    }

    await team.destroy();

    res.status(200).json({ message: 'Team deleted successfully' });
  } catch (error) {
    logger.error('Error deleting team:', error);
    res.status(500).json({ error: 'Failed to delete team' });
  }
};

export const addMember = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { email } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    if (!email) {
      res.status(400).json({ error: 'Email is required' });
      return;
    }

    // Check if requester is a leader
    const membership = await Member.findOne({
      where: { userId, teamId: id, role: 'Leader' }
    });

    if (!membership) {
      res.status(403).json({ error: 'Not authorized to add members to this team' });
      return;
    }

    // Find user to add
    const userToAdd = await User.findOne({ where: { email } });
    if (!userToAdd) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Check if already a member
    const existingMember = await Member.findOne({
      where: { userId: userToAdd.id, teamId: id }
    });

    if (existingMember) {
      res.status(409).json({ error: 'User is already a member of this team' });
      return;
    }

    await Member.create({
      userId: userToAdd.id,
      teamId: id,
      role: 'Member'
    });

    res.status(201).json({
      id: userToAdd.id,
      name: userToAdd.full_name || 'Unknown User',
      status: userToAdd.status,
      role: 'Member'
    });

  } catch (error) {
    logger.error('Error adding member:', error);
    res.status(500).json({ error: 'Failed to add member' });
  }
};

export const removeMember = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id, userId: memberIdToRemove } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    // Check if requester is a leader
    const membership = await Member.findOne({
      where: { userId, teamId: id, role: 'Leader' }
    });

    if (!membership) {
      res.status(403).json({ error: 'Not authorized to remove members from this team' });
      return;
    }

    const memberToRemove = await Member.findOne({
      where: { userId: memberIdToRemove, teamId: id }
    });

    if (!memberToRemove) {
      res.status(404).json({ error: 'Member not found in this team' });
      return;
    }

    await memberToRemove.destroy();

    res.status(200).json({ message: 'Member removed successfully' });

  } catch (error) {
    logger.error('Error removing member:', error);
    res.status(500).json({ error: 'Failed to remove member' });
  }
};

export const getTeamActivity = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const limit = parseInt(req.query.limit as string) || 50;

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    // Check if user is member of the team
    const member = await Member.findOne({
      where: {
        userId,
        teamId: id
      }
    });

    if (!member) {
      res.status(403).json({ error: 'You are not a member of this team' });
      return;
    }

    const activities = await WorkLog.findAll({
      where: { teamId: id },
      order: [['timestamp', 'DESC']],
      limit,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'full_name', 'email'],
          include: [
            {
               model: Member,
               as: 'memberships',
               where: { teamId: id },
               required: false,
               attributes: ['role']
            }
          ]
        },
        {
          model: Ticket,
          as: 'ticket',
          attributes: ['id', 'title']
        }
      ]
    });

    res.status(200).json(activities);
  } catch (error) {
    logger.error('Error fetching team activity:', error);
    res.status(500).json({ error: 'Failed to fetch team activity' });
  }
};
