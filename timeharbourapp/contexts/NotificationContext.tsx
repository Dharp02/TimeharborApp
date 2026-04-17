'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { 
  getNotifications, 
  markAsRead as apiMarkAsRead, 
  markAllAsRead as apiMarkAllAsRead, 
  deleteNotification as apiDeleteNotification,
  deleteNotifications as apiDeleteNotifications,
  Notification as ApiNotification 
} from '@/TimeharborAPI/notifications';
import { useAppSession } from '@/components/AppSessionProvider';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  timestamp: number;
  unread: boolean;
  data?: any;
  type?: string;
}

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  addNotification: (notification: Omit<AppNotification, 'id' | 'timestamp' | 'unread'>) => void;
  markAsRead: (id: string, autoDelete?: boolean) => void;
  markAllAsRead: () => void;
  deleteNotification: (id: string) => void;
  deleteNotifications: (ids: string[]) => void;
  clearAll: () => void;
  refreshNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const { user } = useAppSession();

  const fetchNotifications = useCallback(async () => {
    if (!user?.id) {
      setNotifications([]);
      return;
    }

    try {
      const response = await getNotifications(1, 100);
      const mappedNotifications = response.notifications.map((n: ApiNotification) => ({
        id: n.id,
        title: n.title,
        message: n.body,
        timestamp: new Date(n.createdAt).getTime(),
        unread: !n.readAt,
        data: n.data,
        type: n.type,
      }));
      
      setNotifications(prev => {
        if (JSON.stringify(prev) === JSON.stringify(mappedNotifications)) return prev;
        return mappedNotifications;
      });
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) {
      fetchNotifications();
    } else if (!user) {
      setNotifications([]);
    }
  }, [user?.id, fetchNotifications]);

  const addNotification = (data: Omit<AppNotification, 'id' | 'timestamp' | 'unread'>) => {
    const newNotification: AppNotification = {
      ...data,
      id: uuidv4(),
      timestamp: Date.now(),
      unread: true,
    };
    setNotifications(prev => [newNotification, ...prev]);
  };

  const markAsRead = async (id: string, autoDelete: boolean = true) => {
    if (autoDelete) {
      setNotifications(prev => prev.filter(n => n.id !== id));
      await apiDeleteNotification(id);
    } else {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, unread: false } : n));
      await apiMarkAsRead(id);
    }
  };

  const deleteNotification = async (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    await apiDeleteNotification(id);
  };

  const deleteNotifications = async (ids: string[]) => {
    setNotifications(prev => prev.filter(n => !ids.includes(n.id)));
    await apiDeleteNotifications(ids);
  };

  const markAllAsRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, unread: false })));
    await apiMarkAllAsRead();
  };

  const clearAll = () => {
    setNotifications([]);
  };

  const value = React.useMemo(() => ({
    notifications,
    unreadCount: notifications.filter(n => n.unread).length,
    addNotification,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteNotifications,
    clearAll,
    refreshNotifications: fetchNotifications
  }), [notifications, fetchNotifications]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
