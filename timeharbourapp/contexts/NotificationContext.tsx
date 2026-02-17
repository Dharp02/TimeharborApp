'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { 
  getNotifications, 
  markAsRead as apiMarkAsRead, 
  markAllAsRead as apiMarkAllAsRead, 
  deleteNotification as apiDeleteNotification,
  deleteNotifications as apiDeleteNotifications,
  Notification as ApiNotification 
} from '@/TimeharborAPI/notifications';
import { useAuth } from '@/components/auth/AuthProvider';

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
  const { user } = useAuth();

  const fetchNotifications = async () => {
    if (!user) return;
    try {
      const response = await getNotifications(1, 100); // Fetch first 100
      const mappedNotifications = response.notifications.map((n: ApiNotification) => ({
        id: n.id,
        title: n.title,
        message: n.body,
        timestamp: new Date(n.createdAt).getTime(),
        unread: !n.readAt,
        data: n.data,
        type: n.type,
      }));
      setNotifications(mappedNotifications);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  };

  useEffect(() => {
    if (user) {
      fetchNotifications();
    } else {
      setNotifications([]);
    }
  }, [user]);

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
      // Auto-delete: remove from UI immediately
      setNotifications(prev => prev.filter(n => n.id !== id));
      
      try {
        // Delete from backend
        await apiDeleteNotification(id);
      } catch (error) {
        console.error('Failed to delete notification on server:', error);
      }
    } else {
      // Just mark as read without deleting
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, unread: false } : n)
      );
      
      try {
        await apiMarkAsRead(id);
      } catch (error) {
        console.error('Failed to mark notification as read on server:', error);
      }
    }
  };

  const deleteNotification = async (id: string) => {
    // Optimistic delete
    setNotifications(prev => prev.filter(n => n.id !== id));
    
    try {
      await apiDeleteNotification(id);
    } catch (error) {
      console.error('Failed to delete notification on server:', error);
      // Optionally refetch to restore state on error
      fetchNotifications();
    }
  };

  const deleteNotifications = async (ids: string[]) => {
    // Optimistic delete
    setNotifications(prev => prev.filter(n => !ids.includes(n.id)));
    
    try {
      await apiDeleteNotifications(ids);
    } catch (error) {
      console.error('Failed to delete notifications on server:', error);
      // Optionally refetch to restore state on error
      fetchNotifications();
    }
  };

  const markAllAsRead = async () => {
    // Optimistic update
    setNotifications(prev => 
      prev.map(n => ({ ...n, unread: false }))
    );

    try {
      await apiMarkAllAsRead();
    } catch (error) {
      console.error('Failed to mark all notifications as read on server:', error);
    }
  };

  const clearAll = () => {
    setNotifications([]);
  };

  const unreadCount = notifications.filter(n => n.unread).length;

  return (
    <NotificationContext.Provider value={{ 
      notifications, 
      unreadCount, 
      addNotification, 
      markAsRead, 
      markAllAsRead,
      deleteNotification,
      deleteNotifications,
      clearAll,
      refreshNotifications: fetchNotifications
    }}>
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
