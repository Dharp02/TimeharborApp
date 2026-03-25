import { db } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { getStoredUser } from '../auth';

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

// Mock seeding disabled — real data only
let seeded = false;
async function ensureSeeded() {
  if (seeded) return;
  seeded = true;
  // Mock data seeding removed for real testing
}

/** Reset module-level state after database wipe (e.g. on sign-out). */
export function resetTicketState() {
  seeded = false;
}

const PERSONAL_TEAM_ID = '__personal__';

export const createTicket = async (teamId: string, data: CreateTicketData): Promise<Ticket> => {
  await ensureSeeded();
  const user = await getStoredUser();
  const now = new Date().toISOString();
  const ticket: any = {
    id: uuidv4(),
    title: data.title,
    description: data.description,
    status: data.status || 'Open',
    priority: data.priority || 'Medium',
    link: data.link,
    teamId,
    createdBy: user?.id || 'admin-1',
    assignedTo: data.assignedTo,
    createdAt: now,
    updatedAt: now,
    _dirty: 1,
    _rev: 1,
    fieldTimestamps: { title: now, status: now, priority: now },
  };
  await db.tickets.put(ticket);
  return ticket;
};

export const getTickets = async (teamId: string, options?: { sort?: string; status?: string }): Promise<Ticket[]> => {
  await ensureSeeded();
  const allTickets = (await db.tickets.where('teamId').equals(teamId).toArray())
    .filter((t: any) => !t._deleted);
  if (options?.status === 'open') return allTickets.filter(t => t.status !== 'Closed');
  if (options?.status) return allTickets.filter(t => t.status.toLowerCase() === options.status!.toLowerCase());
  return allTickets;
};

export const updateTicket = async (_teamId: string, ticketId: string, data: UpdateTicketData): Promise<Ticket> => {
  const existing = await db.tickets.get(ticketId) as any;
  if (!existing) throw new Error('Ticket not found');
  const now = new Date().toISOString();
  const prevTs = existing.fieldTimestamps ?? {};
  const newTs = { ...prevTs };
  for (const key of Object.keys(data)) {
    newTs[key] = now;
  }
  const updated = {
    ...existing,
    ...data,
    updatedAt: now,
    _dirty: 1,
    _rev: (existing._rev ?? 0) + 1,
    fieldTimestamps: newTs,
  };
  await db.tickets.put(updated);
  return updated;
};

export const deleteTicket = async (_teamId: string, ticketId: string): Promise<void> => {
  const existing = await db.tickets.get(ticketId) as any;
  if (existing?._serverId) {
    // Soft-delete so sync can push the deletion to the server
    await db.tickets.update(ticketId, {
      _deleted: true,
      _dirty: 1,
      _rev: (existing._rev ?? 0) + 1,
      updatedAt: new Date().toISOString(),
    } as any);
  } else {
    await db.tickets.delete(ticketId);
  }
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
  return (await db.tickets.toArray()).filter((t: any) => !t._deleted);
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
