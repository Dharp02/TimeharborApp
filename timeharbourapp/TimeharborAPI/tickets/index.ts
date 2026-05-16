import { db } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { getIdentityUUID } from '../sync/IdentityManager';
import { operationsLog } from '../OperationsLog';
import { opLogWriter } from '../sync/OpLogWriter';

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
  /** Milliseconds already pushed to TimeHuddle. pendingMs = trackedMs - _pushedMs */
  _pushedMs?: number;
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
  const now = new Date().toISOString();
  const isTimehuddle = teamId !== PERSONAL_TEAM_ID;
  const ticket: any = {
    id: uuidv4(),
    title: data.title,
    description: data.description,
    status: data.status || 'Open',
    priority: data.priority || 'Medium',
    link: data.link,
    teamId,
    createdBy: getIdentityUUID(),
    assignedTo: data.assignedTo,
    createdAt: now,
    updatedAt: now,
    source: isTimehuddle ? 'timehuddle' : 'personal',
    fieldTimestamps: { title: now, status: now, priority: now },
  };
  try {
    await db.tickets.put(ticket);
    await opLogWriter.recordCreate('tickets', ticket.id, ticket, { syncEnabled: !isTimehuddle });
    await operationsLog.log({ category: 'TICKET', action: 'CREATE', result: 'success', target: 'Ticket', targetId: ticket.id, details: { title: data.title, teamId } });
    return ticket;
  } catch (err: any) {
    await operationsLog.log({ category: 'TICKET', action: 'CREATE', result: 'failure', target: 'Ticket', errorMessage: err?.message, details: { title: data.title, teamId } });
    throw err;
  }
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
  const isTimehuddle = existing.source === 'timehuddle';
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
    fieldTimestamps: newTs,
  };
  try {
    await db.tickets.put(updated);
    await opLogWriter.recordUpdate('tickets', ticketId, { ...data, updatedAt: now, fieldTimestamps: newTs }, { syncEnabled: !isTimehuddle });
    await operationsLog.log({ category: 'TICKET', action: 'UPDATE', result: 'success', target: 'Ticket', targetId: ticketId, details: { fields: Object.keys(data) } });
    return updated;
  } catch (err: any) {
    await operationsLog.log({ category: 'TICKET', action: 'UPDATE', result: 'failure', target: 'Ticket', targetId: ticketId, errorMessage: err?.message });
    throw err;
  }
};

export const deleteTicket = async (_teamId: string, ticketId: string): Promise<void> => {
  try {
    const existing = await db.tickets.get(ticketId) as any;
    const isTimehuddle = existing?.source === 'timehuddle';
    // Always soft-delete — op-log sync handles propagation
    await db.tickets.update(ticketId, {
      _deleted: true,
      updatedAt: new Date().toISOString(),
    } as any);
    await opLogWriter.recordDelete('tickets', ticketId, { syncEnabled: !isTimehuddle });
    await operationsLog.log({ category: 'TICKET', action: 'DELETE', result: 'success', target: 'Ticket', targetId: ticketId });
  } catch (err: any) {
    await operationsLog.log({ category: 'TICKET', action: 'DELETE', result: 'failure', target: 'Ticket', targetId: ticketId, errorMessage: err?.message });
    throw err;
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
  await operationsLog.log({ category: 'TICKET', action: 'SHARE', result: 'success', target: 'Ticket', targetId: ticketId });
  return updated;
};

export const updatePersonalTicket = async (ticketId: string, data: UpdateTicketData): Promise<Ticket> => {
  return updateTicket(PERSONAL_TEAM_ID, ticketId, data);
};

export const deletePersonalTicket = async (ticketId: string): Promise<void> => {
  return deleteTicket(PERSONAL_TEAM_ID, ticketId);
};
