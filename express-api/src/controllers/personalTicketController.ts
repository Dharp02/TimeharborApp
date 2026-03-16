import { Request, Response } from 'express';
import { Op, ValidationError } from 'sequelize';
import { Ticket, User } from '../models';
import { AuthRequest } from '../middleware/authMiddleware';
import sequelize from '../config/sequelize';

export const createPersonalTicket = async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  try {
    const { id, title, description, priority, link, status } = authReq.body;
    const userId = authReq.user!.id;

    const ticket = await Ticket.create({
      id,
      title,
      description,
      priority,
      link,
      teamId: null,
      createdBy: userId,
      assignedTo: userId,
      status: status || 'Open',
    });

    const ticketWithDetails = await Ticket.findByPk(ticket.id, {
      include: [
        { model: User, as: 'creator', attributes: ['id', 'full_name', 'email'] },
        { model: User, as: 'assignee', attributes: ['id', 'full_name', 'email'] },
      ],
    });

    res.status(201).json(ticketWithDetails);
  } catch (error) {
    console.error('Error creating personal ticket:', error);
    res.status(500).json({ message: 'Error creating ticket' });
  }
};

export const getPersonalTickets = async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  try {
    const { sort, status } = req.query;
    const userId = authReq.user!.id;

    const whereClause: any = { teamId: null, createdBy: userId };

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
        ['createdAt', 'DESC'],
      ];
    }

    const tickets = await Ticket.findAll({
      where: whereClause,
      include: [
        { model: User, as: 'creator', attributes: ['id', 'full_name', 'email'] },
        { model: User, as: 'assignee', attributes: ['id', 'full_name', 'email'] },
      ],
      order,
    });

    res.json(tickets);
  } catch (error) {
    console.error('Error fetching personal tickets:', error);
    res.status(500).json({ message: 'Error fetching tickets' });
  }
};

export const updatePersonalTicket = async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  try {
    const { ticketId } = authReq.params;
    const { title, description, status, priority, link } = authReq.body;
    const userId = authReq.user!.id;

    const ticket = await Ticket.findOne({ where: { id: ticketId, teamId: null, createdBy: userId } });
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    if (title) ticket.title = title;
    if (description !== undefined) ticket.description = description;
    if (status) ticket.status = status;
    if (priority) ticket.priority = priority;
    if (link !== undefined) ticket.link = link;

    await ticket.save();

    const updatedTicket = await Ticket.findByPk(ticket.id, {
      include: [
        { model: User, as: 'creator', attributes: ['id', 'full_name', 'email'] },
        { model: User, as: 'assignee', attributes: ['id', 'full_name', 'email'] },
      ],
    });

    res.json(updatedTicket);
  } catch (error: any) {
    if (error instanceof ValidationError) {
      return res.status(400).json({ message: error.message });
    }
    console.error('Error updating personal ticket:', error);
    res.status(500).json({ message: 'Error updating ticket' });
  }
};

export const deletePersonalTicket = async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  try {
    const { ticketId } = authReq.params;
    const userId = authReq.user!.id;

    const ticket = await Ticket.findOne({ where: { id: ticketId, teamId: null, createdBy: userId } });
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    await ticket.destroy();
    res.json({ message: 'Ticket deleted successfully' });
  } catch (error) {
    console.error('Error deleting personal ticket:', error);
    res.status(500).json({ message: 'Error deleting ticket' });
  }
};
