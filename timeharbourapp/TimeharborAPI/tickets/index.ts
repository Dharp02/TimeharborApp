import { authenticatedFetch, getStoredUser } from '../auth';
import { db } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { getApiUrl } from '../apiUrl';

const API_URL = getApiUrl();

export interface Ticket {
  id: string;
  title: string;
  description?: string;
  status: 'Open' | 'In Progress' | 'Closed';
  priority: 'Low' | 'Medium' | 'High';
  link?: string;
  teamId: string;
  createdBy: string;
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
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
  status?: 'Open' | 'In Progress' | 'Closed';
  priority?: 'Low' | 'Medium' | 'High';
  link?: string;
  assignedTo?: string;
}

export interface UpdateTicketData {
  title?: string;
  description?: string;
  status?: 'Open' | 'In Progress' | 'Closed';
  priority?: 'Low' | 'Medium' | 'High';
  link?: string;
  assignedTo?: string;
}

export const createTicket = async (teamId: string, data: CreateTicketData): Promise<Ticket> => {
  // Generate ID client-side for offline-first consistency
  const id = uuidv4();

  try {
    const response = await authenticatedFetch(`${API_URL}/teams/${teamId}/tickets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...data, id }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create ticket');
    }

    const ticket = await response.json();
    await db.tickets.put(ticket);
    return ticket;
  } catch (error) {
    console.error('Create ticket failed, storing offline:', error);
    
    const user = await getStoredUser();

    // Create temporary ticket for offline use
    let assignee;
    if (data.assignedTo) {
      const teams = await db.teams.toArray();
      for (const team of teams) {
        const member = team.members.find(m => m.id === data.assignedTo);
        if (member) {
          assignee = {
            id: member.id,
            full_name: member.name,
            email: member.email || ''
          };
          break;
        }
      }
    }

    const tempTicket: Ticket = {
      id, // Use the pre-generated ID
      title: data.title,
      description: data.description,
      status: data.status || 'Open',
      priority: data.priority || 'Medium',
      link: data.link,
      teamId,
      createdBy: user?.id || 'offline-user',
      assignedTo: data.assignedTo,
      assignee,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.tickets.put(tempTicket);
    
    await db.offlineMutations.add({
      url: `${API_URL}/teams/${teamId}/tickets`,
      method: 'POST',
      body: { ...data, id }, // Include ID in the mutation body
      timestamp: Date.now(),
      retryCount: 0,
      tempId: id
    });

    return tempTicket;
  }
};

export const getTickets = async (teamId: string, options?: { sort?: string; status?: string }): Promise<Ticket[]> => {
  const loadFromCache = async () => {
    const allTickets = await db.tickets.where('teamId').equals(teamId).toArray();
    if (options?.status === 'open') {
      return allTickets.filter(t => t.status !== 'Closed');
    }
    if (options?.status) {
      return allTickets.filter(t => t.status.toLowerCase() === options.status!.toLowerCase());
    }
    return allTickets;
  };

  // Skip network entirely when offline
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return loadFromCache();
  }

  try {
    const queryParams = new URLSearchParams();
    if (options?.sort) queryParams.append('sort', options.sort);
    if (options?.status) queryParams.append('status', options.status);

    const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';

    const response = await authenticatedFetch(`${API_URL}/teams/${teamId}/tickets${queryString}`, {
      method: 'GET',
    });

    if (!response.ok) {
      const errorBody = await response.json();
      const err: any = new Error(errorBody.message || 'Failed to fetch tickets');
      err.status = response.status;
      throw err;
    }

    const tickets = await response.json();
    await db.tickets.bulkPut(tickets);
    return tickets;
  } catch (error: any) {
    // 403 = genuine access denied (user not a member of this team).
    // Do NOT serve stale cache data — return empty to avoid showing another user's tickets.
    if (error?.status === 403) {
      console.warn(`Tickets fetch denied (403) for team ${teamId} — user may no longer be a member.`);
      return [];
    }
    console.warn('Fetching tickets failed, loading from offline cache:', error);
    return loadFromCache();
  }
};

export const updateTicket = async (teamId: string, ticketId: string, data: UpdateTicketData): Promise<Ticket> => {
  try {
    const response = await authenticatedFetch(`${API_URL}/teams/${teamId}/tickets/${ticketId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update ticket');
    }

    const ticket = await response.json();
    await db.tickets.put(ticket);
    return ticket;
  } catch (error) {
    console.error('Update ticket failed, storing offline:', error);

    // Update local cache
    const existingTicket = await db.tickets.get(ticketId);
    if (existingTicket) {
      let assignee = existingTicket.assignee;
      
      // If assignedTo is changing, try to find the new assignee details
      if (data.assignedTo && data.assignedTo !== existingTicket.assignedTo) {
        const teams = await db.teams.toArray();
        for (const team of teams) {
          const member = team.members.find(m => m.id === data.assignedTo);
          if (member) {
            assignee = {
              id: member.id,
              full_name: member.name,
              email: member.email || ''
            };
            break;
          }
        }
      }

      const updatedTicket = { 
        ...existingTicket, 
        ...data, 
        assignee,
        updatedAt: new Date().toISOString() 
      };
      await db.tickets.put(updatedTicket);
      
      await db.offlineMutations.add({
        url: `${API_URL}/teams/${teamId}/tickets/${ticketId}`,
        method: 'PUT',
        body: data,
        timestamp: Date.now(),
        retryCount: 0
      });
      
      return updatedTicket;
    }
    throw error;
  }
};

export const deleteTicket = async (teamId: string, ticketId: string): Promise<void> => {
  try {
    const response = await authenticatedFetch(`${API_URL}/teams/${teamId}/tickets/${ticketId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to delete ticket');
    }
    
    await db.tickets.delete(ticketId);
  } catch (error) {
    console.error('Delete ticket failed, storing offline:', error);
    
    await db.tickets.delete(ticketId);
    
    await db.offlineMutations.add({
      url: `${API_URL}/teams/${teamId}/tickets/${ticketId}`,
      method: 'DELETE',
      body: {},
      timestamp: Date.now(),
      retryCount: 0
    });
  }
};

// ─── Personal Tickets (no team) ────────────────────────────────────────────

const PERSONAL_TEAM_ID = '__personal__';

export const createPersonalTicket = async (data: CreateTicketData): Promise<Ticket> => {
  const id = uuidv4();
  try {
    const response = await authenticatedFetch(`${API_URL}/me/tickets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, id }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create ticket');
    }
    const ticket = await response.json();
    await db.tickets.put({ ...ticket, teamId: ticket.teamId || PERSONAL_TEAM_ID });
    return ticket;
  } catch (error) {
    console.error('Create personal ticket failed, storing offline:', error);
    const user = await getStoredUser();
    const tempTicket: Ticket = {
      id,
      title: data.title,
      description: data.description,
      status: data.status || 'Open',
      priority: data.priority || 'Medium',
      link: data.link,
      teamId: PERSONAL_TEAM_ID,
      createdBy: user?.id || 'offline-user',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.tickets.put(tempTicket);
    await db.offlineMutations.add({
      url: `${API_URL}/me/tickets`,
      method: 'POST',
      body: { ...data, id },
      timestamp: Date.now(),
      retryCount: 0,
      tempId: id,
    });
    return tempTicket;
  }
};

export const getPersonalTickets = async (options?: { sort?: string; status?: string }): Promise<Ticket[]> => {
  const loadFromCache = async () => {
    const allTickets = await db.tickets.where('teamId').equals(PERSONAL_TEAM_ID).toArray();
    if (options?.status === 'open') return allTickets.filter(t => t.status !== 'Closed');
    if (options?.status) return allTickets.filter(t => t.status.toLowerCase() === options.status!.toLowerCase());
    return allTickets;
  };

  if (typeof navigator !== 'undefined' && !navigator.onLine) return loadFromCache();

  try {
    const qp = new URLSearchParams();
    if (options?.sort) qp.append('sort', options.sort);
    if (options?.status) qp.append('status', options.status);
    const qs = qp.toString() ? `?${qp.toString()}` : '';

    const response = await authenticatedFetch(`${API_URL}/me/tickets${qs}`, { method: 'GET' });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.message || 'Failed to fetch personal tickets');
    }
    const tickets: Ticket[] = await response.json();
    const withTeamId = tickets.map(t => ({ ...t, teamId: t.teamId || PERSONAL_TEAM_ID }));
    await db.tickets.bulkPut(withTeamId);
    return withTeamId;
  } catch (error) {
    console.warn('Fetching personal tickets failed, loading from cache:', error);
    return loadFromCache();
  }
};

export const updatePersonalTicket = async (ticketId: string, data: UpdateTicketData): Promise<Ticket> => {
  try {
    const response = await authenticatedFetch(`${API_URL}/me/tickets/${ticketId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update ticket');
    }
    const ticket = await response.json();
    await db.tickets.put({ ...ticket, teamId: ticket.teamId || PERSONAL_TEAM_ID });
    return ticket;
  } catch (error) {
    console.error('Update personal ticket failed, storing offline:', error);
    const existing = await db.tickets.get(ticketId);
    if (existing) {
      const updated = { ...existing, ...data, updatedAt: new Date().toISOString() };
      await db.tickets.put(updated);
      await db.offlineMutations.add({
        url: `${API_URL}/me/tickets/${ticketId}`,
        method: 'PUT',
        body: data,
        timestamp: Date.now(),
        retryCount: 0,
      });
      return updated;
    }
    throw error;
  }
};

export const deletePersonalTicket = async (ticketId: string): Promise<void> => {
  try {
    const response = await authenticatedFetch(`${API_URL}/me/tickets/${ticketId}`, { method: 'DELETE' });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to delete ticket');
    }
    await db.tickets.delete(ticketId);
  } catch (error) {
    console.error('Delete personal ticket failed, storing offline:', error);
    await db.tickets.delete(ticketId);
    await db.offlineMutations.add({
      url: `${API_URL}/me/tickets/${ticketId}`,
      method: 'DELETE',
      body: {},
      timestamp: Date.now(),
      retryCount: 0,
    });
  }
};
