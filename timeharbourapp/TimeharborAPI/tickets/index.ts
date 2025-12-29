import { authenticatedFetch, getStoredUser } from '../auth';
import { db } from '../db';
import { v4 as uuidv4 } from 'uuid';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

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
  try {
    const response = await authenticatedFetch(`${API_URL}/teams/${teamId}/tickets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
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
    const tempId = uuidv4();
    const tempTicket: Ticket = {
      id: tempId,
      title: data.title,
      description: data.description,
      status: data.status || 'Open',
      priority: data.priority || 'Medium',
      link: data.link,
      teamId,
      createdBy: user?.id || 'offline-user',
      assignedTo: data.assignedTo,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.tickets.put(tempTicket);
    
    await db.offlineMutations.add({
      url: `${API_URL}/teams/${teamId}/tickets`,
      method: 'POST',
      body: data,
      timestamp: Date.now(),
      retryCount: 0
    });

    return tempTicket;
  }
};

export const getTickets = async (teamId: string, options?: { sort?: string; status?: string }): Promise<Ticket[]> => {
  try {
    const queryParams = new URLSearchParams();
    if (options?.sort) queryParams.append('sort', options.sort);
    if (options?.status) queryParams.append('status', options.status);

    const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';

    const response = await authenticatedFetch(`${API_URL}/teams/${teamId}/tickets${queryString}`, {
      method: 'GET',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch tickets');
    }

    const tickets = await response.json();
    await db.tickets.bulkPut(tickets);
    return tickets;
  } catch (error) {
    console.warn('Fetching tickets failed, loading from offline cache:', error);
    
    let collection = db.tickets.where('teamId').equals(teamId);
    
    // Basic client-side filtering
    if (options?.status) {
      const status = options.status;
      const tickets = await collection.toArray();
      return tickets.filter(t => t.status === status);
    }

    return collection.toArray();
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
      const updatedTicket = { ...existingTicket, ...data, updatedAt: new Date().toISOString() };
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
