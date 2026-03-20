import { db } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { getStoredUser } from '../auth';
import { mockTickets } from '../mockData';

export interface Ticket {
  id: string;
  title: string;
  description?: string;
  status: 'Open' | 'In Progress' | 'Closed' | 'Done';
  priority: 'Low' | 'Medium' | 'High';
  link?: string;
  teamId: string;
  teamName?: string;
  createdBy: string;
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
  source?: 'personal' | 'timehuddle';
  syncedWithTimehuddle?: boolean;
  sharedToTimehuddle?: boolean;
  pulseVideo?: {
    url: string;
    recordedAt: string;
    duration: string;
  };
  trackedTime?: string;
  trackedMs?: number;
  projectId?: string;
  projectName?: string;
  creator?: {
    id: string;
    full_name: string;
    email: string;
  };
  assignee?: {
    id: string;
    full_name: string;
    email: string;
  };
}

export interface CreateTicketData {
  title: string;
  description?: string;
  status?: 'Open' | 'In Progress' | 'Closed' | 'Done';
  priority?: 'Low' | 'Medium' | 'High';
  link?: string;
  assignedTo?: string;
}

export interface UpdateTicketData {
  title?: string;
  description?: string;
  status?: 'Open' | 'In Progress' | 'Closed' | 'Done';
  priority?: 'Low' | 'Medium' | 'High';
  link?: string;
  assignedTo?: string;
  sharedToTimehuddle?: boolean;
}

// Seed Dexie with mock data on first read
let seeded = false;
async function ensureSeeded() {
  if (seeded) return;
  seeded = true;
  const count = await db.tickets.count();
  if (count === 0) {
    await db.tickets.bulkPut(mockTickets);
  }
}

const PERSONAL_TEAM_ID = '__personal__';

export const createTicket = async (teamId: string, data: CreateTicketData): Promise<Ticket> => {
  await ensureSeeded();
  const user = await getStoredUser();
  const ticket: Ticket = {
    id: uuidv4(),
    title: data.title,
    description: data.description,
    status: data.status || 'Open',
    priority: data.priority || 'Medium',
    link: data.link,
    teamId,
    createdBy: user?.id || 'admin-1',
    assignedTo: data.assignedTo,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await db.tickets.put(ticket);
  return ticket;
};

export const getTickets = async (teamId: string, options?: { sort?: string; status?: string }): Promise<Ticket[]> => {
  await ensureSeeded();
  const allTickets = await db.tickets.where('teamId').equals(teamId).toArray();
  if (options?.status === 'open') return allTickets.filter(t => t.status !== 'Closed');
  if (options?.status) return allTickets.filter(t => t.status.toLowerCase() === options.status!.toLowerCase());
  return allTickets;
};

export const updateTicket = async (_teamId: string, ticketId: string, data: UpdateTicketData): Promise<Ticket> => {
  const existing = await db.tickets.get(ticketId);
  if (!existing) throw new Error('Ticket not found');
  const updated = { ...existing, ...data, updatedAt: new Date().toISOString() };
  await db.tickets.put(updated);
  return updated;
};

export const deleteTicket = async (_teamId: string, ticketId: string): Promise<void> => {
  await db.tickets.delete(ticketId);
};

// Personal Tickets

export const createPersonalTicket = async (data: CreateTicketData): Promise<Ticket> => {
  return createTicket(PERSONAL_TEAM_ID, data);
};

export const getPersonalTickets = async (options?: { sort?: string; status?: string }): Promise<Ticket[]> => {
  return getTickets(PERSONAL_TEAM_ID, options);
};

export const getAllTickets = async (): Promise<Ticket[]> => {
  await ensureSeeded();
  return db.tickets.toArray();
};

export const getTimehuddleTickets = async (): Promise<Ticket[]> => {
  await ensureSeeded();
  const all = await db.tickets.toArray();
  return all.filter(t => t.source === 'timehuddle');
};

export const shareToTimehuddle = async (ticketId: string): Promise<Ticket> => {
  const existing = await db.tickets.get(ticketId);
  if (!existing) throw new Error('Ticket not found');
  const updated = { ...existing, sharedToTimehuddle: true, updatedAt: new Date().toISOString() };
  await db.tickets.put(updated);
  return updated;
};

export const updatePersonalTicket = async (ticketId: string, data: UpdateTicketData): Promise<Ticket> => {
  return updateTicket(PERSONAL_TEAM_ID, ticketId, data);
};

export const deletePersonalTicket = async (ticketId: string): Promise<void> => {
  return deleteTicket(PERSONAL_TEAM_ID, ticketId);
};
