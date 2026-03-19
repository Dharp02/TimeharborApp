import { mockNotifications } from '../mockData';

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

// In-memory store so delete/markRead persist within a session
let localNotifications = [...mockNotifications];

export const getNotifications = async (_page: number = 1, _limit: number = 20): Promise<NotificationsResponse> => {
  return {
    notifications: localNotifications,
    total: localNotifications.length,
    page: 1,
    totalPages: 1,
  };
};

export const markAsRead = async (id: string): Promise<Notification> => {
  const n = localNotifications.find(n => n.id === id);
  if (n) n.readAt = new Date().toISOString();
  return n!;
};

export const markAllAsRead = async (): Promise<void> => {
  localNotifications.forEach(n => { n.readAt = new Date().toISOString(); });
};

export const deleteNotification = async (id: string): Promise<void> => {
  localNotifications = localNotifications.filter(n => n.id !== id);
};

export const deleteNotifications = async (ids: string[]): Promise<{ count: number }> => {
  const idSet = new Set(ids);
  const before = localNotifications.length;
  localNotifications = localNotifications.filter(n => !idSet.has(n.id));
  return { count: before - localNotifications.length };
};
