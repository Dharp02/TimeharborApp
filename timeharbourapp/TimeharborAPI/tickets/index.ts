import { authenticatedFetch } from '../auth';

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

  return response.json();
};

export const getTickets = async (teamId: string, options?: { sort?: string; status?: string }): Promise<Ticket[]> => {
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

  return response.json();
};

export const updateTicket = async (teamId: string, ticketId: string, data: UpdateTicketData): Promise<Ticket> => {
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

  return response.json();
};

export const deleteTicket = async (teamId: string, ticketId: string): Promise<void> => {
  const response = await authenticatedFetch(`${API_URL}/teams/${teamId}/tickets/${ticketId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to delete ticket');
  }
};
