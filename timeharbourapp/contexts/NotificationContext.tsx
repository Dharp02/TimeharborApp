'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { getNotifications, markAsRead as apiMarkAsRead, markAllAsRead as apiMarkAllAsRead, Notification as ApiNotification } from '@/TimeharborAPI/notifications';
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
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
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

  const markAsRead = async (id: string) => {
    // Optimistic update
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, unread: false } : n)
    );
    
    try {
      // Check if it's a backend notification (UUID vs pure UUID v4 generated on client might be distinguishable, 
      // but for now we try API and catch error if not found or if it's local only)
      await apiMarkAsRead(id);
    } catch (error) {
      console.error('Failed to mark notification as read on server:', error);
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
