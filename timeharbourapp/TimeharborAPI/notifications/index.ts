import { authenticatedFetch } from '../auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface Notification {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: string;
  data?: any;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationsResponse {
  notifications: Notification[];
  total: number;
  page: number;
  totalPages: number;
}

export const getNotifications = async (page: number = 1, limit: number = 20): Promise<NotificationsResponse> => {
  const response = await authenticatedFetch(`${API_URL}/notifications?page=${page}&limit=${limit}`);
  
  if (!response.ok) {
    throw new Error('Failed to fetch notifications');
  }

  return response.json();
};

export const markAsRead = async (id: string): Promise<Notification> => {
  const response = await authenticatedFetch(`${API_URL}/notifications/${id}/read`, {
    method: 'PATCH',
  });

  if (!response.ok) {
    throw new Error('Failed to mark notification as read');
  }

  return response.json();
};

export const markAllAsRead = async (): Promise<void> => {
  const response = await authenticatedFetch(`${API_URL}/notifications/read-all`, {
    method: 'PATCH',
  });

  if (!response.ok) {
    throw new Error('Failed to mark all notifications as read');
  }
};

export const deleteNotification = async (id: string): Promise<void> => {
  const response = await authenticatedFetch(`${API_URL}/notifications/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error('Failed to delete notification');
  }
};

export const deleteNotifications = async (ids: string[]): Promise<{ count: number }> => {
  const response = await authenticatedFetch(`${API_URL}/notifications`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ids }),
  });

  if (!response.ok) {
    throw new Error('Failed to delete notifications');
  }

  return response.json();
};
