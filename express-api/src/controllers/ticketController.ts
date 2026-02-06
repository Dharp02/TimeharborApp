import { Request, Response } from 'express';
import { Op } from 'sequelize';
import { Ticket, Member, User, Team } from '../models';
import { AuthRequest } from '../middleware/authMiddleware';
import sequelize from '../config/sequelize';
import { sendTicketAssignmentNotification } from '../services/notificationService';

export const createTicket = async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  try {
    const { teamId } = authReq.params;
    const { id, title, description, priority, link, assignedTo, status } = authReq.body;
    const userId = authReq.user!.id;

    // Check if user is a member of the team
    const member = await Member.findOne({ where: { userId, teamId } });
    if (!member) {
      return res.status(403).json({ message: 'You are not a member of this team' });
    }

    // If assignedTo is provided, check if the assignee is a member of the team
    if (assignedTo) {
      const assigneeMember = await Member.findOne({ where: { userId: assignedTo, teamId } });
      if (!assigneeMember) {
        return res.status(400).json({ message: 'Assignee is not a member of this team' });
      }
    }

    const ticket = await Ticket.create({
      id,
      title,
      description,
      priority,
      link,
      teamId,
      createdBy: userId,
      assignedTo,
      status: status || 'Open'
    });

    // Send push notification if ticket is assigned
    if (assignedTo && assignedTo !== userId) {
      sendTicketAssignmentNotification(assignedTo, title, id).catch(err => 
        console.error('Failed to send ticket assignment notification:', err)
      );
    }

    const ticketWithDetails = await Ticket.findByPk(ticket.id, {
      include: [
        { model: User, as: 'creator', attributes: ['id', 'full_name', 'email'] },
        { model: User, as: 'assignee', attributes: ['id', 'full_name', 'email'] }
      ]
    });

    res.status(201).json(ticketWithDetails);
  } catch (error) {
    console.error('Error creating ticket:', error);
    res.status(500).json({ message: 'Error creating ticket' });
  }
};

export const getTickets = async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  try {
    const { teamId } = authReq.params;
    const { sort, status } = req.query;
    const userId = authReq.user!.id;

    // Check if user is a member of the team
    const member = await Member.findOne({ where: { userId, teamId } });
    if (!member) {
      return res.status(403).json({ message: 'You are not a member of this team' });
    }

    const whereClause: any = { teamId };
    
    if (status === 'open') {
      whereClause.status = { [Op.ne]: 'Closed' };
    } else if (status) {
      whereClause.status = status;
    }

    let order: any = [['createdAt', 'DESC']];

    if (sort === 'recent') {
      order = [
        [sequelize.literal(`(
          SELECT MAX("timestamp")
          FROM "work_logs" AS "WorkLog"
          WHERE "WorkLog"."ticketId" = "Ticket"."id"
        )`), 'DESC NULLS LAST'],
        ['createdAt', 'DESC']
      ];
    }

    const tickets = await Ticket.findAll({
      where: whereClause,
      include: [
        { model: User, as: 'creator', attributes: ['id', 'full_name', 'email'] },
        { model: User, as: 'assignee', attributes: ['id', 'full_name', 'email'] }
      ],
      order: order
    });

    res.json(tickets);
  } catch (error) {
    console.error('Error fetching tickets:', error);
    res.status(500).json({ message: 'Error fetching tickets' });
  }
};

export const updateTicket = async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  try {
    const { teamId, ticketId } = authReq.params;
    const { title, description, status, priority, link, assignedTo } = authReq.body;
    const userId = authReq.user!.id;

    // Check if user is a member of the team
    const member = await Member.findOne({ where: { userId, teamId } });
    if (!member) {
      return res.status(403).json({ message: 'You are not a member of this team' });
    }

    const ticket = await Ticket.findOne({ where: { id: ticketId, teamId } });
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    const isCreator = ticket.createdBy === userId;

    // Permission checks
    if (!isCreator) {
      // Non-creators can only update status
      if (title || description || priority || link || assignedTo) {
        return res.status(403).json({ message: 'Only the creator can edit ticket details or assign members. You can only update status.' });
      }
    }

    // If assigning, check if assignee is member
    if (assignedTo && assignedTo !== ticket.assignedTo) {
        if (!isCreator) {
             return res.status(403).json({ message: 'Only the creator can assign tickets.' });
        }
        const assigneeMember = await Member.findOne({ where: { userId: assignedTo, teamId } });
        if (!assigneeMember) {
            return res.status(400).json({ message: 'Assignee is not a member of this team' });
        }
    }

    // Update fields
    const oldAssignedTo = ticket.assignedTo;
    if (isCreator) {
        if (title) ticket.title = title;
        if (description !== undefined) ticket.description = description;
        if (priority) ticket.priority = priority;
        if (link !== undefined) ticket.link = link;
        if (assignedTo !== undefined) ticket.assignedTo = assignedTo;
    }
    
    if (status) ticket.status = status;

    await ticket.save();

    // Send push notification if assignee changed
    if (assignedTo && assignedTo !== oldAssignedTo && assignedTo !== userId) {
      sendTicketAssignmentNotification(assignedTo, ticket.title, ticket.id).catch(err => 
        console.error('Failed to send ticket assignment notification:', err)
      );
    }

    const updatedTicket = await Ticket.findByPk(ticket.id, {
      include: [
        { model: User, as: 'creator', attributes: ['id', 'full_name', 'email'] },
        { model: User, as: 'assignee', attributes: ['id', 'full_name', 'email'] }
      ]
    });

    res.json(updatedTicket);
  } catch (error) {
    console.error('Error updating ticket:', error);
    res.status(500).json({ message: 'Error updating ticket' });
  }
};

export const deleteTicket = async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  try {
    const { teamId, ticketId } = authReq.params;
    const userId = authReq.user!.id;

    // Check if user is a member of the team
    const member = await Member.findOne({ where: { userId, teamId } });
    if (!member) {
      return res.status(403).json({ message: 'You are not a member of this team' });
    }

    const ticket = await Ticket.findOne({ where: { id: ticketId, teamId } });
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    if (ticket.createdBy !== userId) {
      return res.status(403).json({ message: 'Only the creator can delete this ticket' });
    }

    await ticket.destroy();
    res.json({ message: 'Ticket deleted successfully' });
  } catch (error) {
    console.error('Error deleting ticket:', error);
    res.status(500).json({ message: 'Error deleting ticket' });
  }
};
