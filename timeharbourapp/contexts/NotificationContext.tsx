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
import { useAuth } from '@/components/auth/AuthProvider';
import { db } from '@/lib/db';

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
  
  // Track IDs pending deletion to prevent race conditions where a fetch reinstates a deleted item
  const locallyDeletedIds = React.useRef<Set<string>>(new Set());

  const fetchNotifications = useCallback(async () => {
    if (!user?.id) {
      setNotifications([]);
      return;
    }

    try {
      const response = await getNotifications(1, 100);
      
      // Get the set of IDs currently on the server
      const serverIds = new Set(response.notifications.map((n: ApiNotification) => n.id));

      // Get offline mutations from Dexie (pending deletions)
      const offlineMutations = await db.offlineMutations
        .where('method').equals('DELETE')
        .filter(m => m.url.includes('/notifications'))
        .toArray();

      // Extract IDs from offline mutations
      offlineMutations.forEach(mutation => {
        // Handle single delete: /notifications/:id
        const singleMatch = mutation.url.match(/\/notifications\/([^\/]+)$/);
        if (singleMatch && singleMatch[1]) {
          locallyDeletedIds.current.add(singleMatch[1]);
        }
        
        // Handle batch delete: body contains ids
        if (mutation.url.endsWith('/notifications') && mutation.body?.ids) {
          mutation.body.ids.forEach((id: string) => locallyDeletedIds.current.add(id));
        }
      });

      // Cleanup: If we have a locally deleted ID that is NO LONGER on the server,
      // we can stop tracking it. It's successfully gone.
      locallyDeletedIds.current.forEach(id => {
        if (!serverIds.has(id)) {
          // Check if there is still a pending mutation for this ID
          const hasPendingMutation = offlineMutations.some(m => {
             const singleMatch = m.url.match(/\/notifications\/([^\/]+)$/);
             if (singleMatch && singleMatch[1] === id) return true;
             if (m.body?.ids && m.body.ids.includes(id)) return true;
             return false;
          });
          
          if (!hasPendingMutation) {
            locallyDeletedIds.current.delete(id);
          }
        }
      });

      const mappedNotifications = response.notifications
        .filter((n: ApiNotification) => !locallyDeletedIds.current.has(n.id))
        .map((n: ApiNotification) => ({
          id: n.id,
          title: n.title,
          message: n.body,
          timestamp: new Date(n.createdAt).getTime(),
          unread: !n.readAt,
          data: n.data,
          type: n.type,
        }));
      
      // Use functional update to prevent unnecessary re-renders if data hasn't changed
      setNotifications(prev => {
        // Simple check to see if we really need to update state
        if (JSON.stringify(prev) === JSON.stringify(mappedNotifications)) {
          return prev;
        }
        return mappedNotifications;
      });
      
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  }, [user?.id]); // Only depend on user ID, not the whole user object

  useEffect(() => {
    // Only fetch if we have a user
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
      locallyDeletedIds.current.add(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
      
      try {
        await apiDeleteNotification(id);
      } catch (error: any) {
        console.error('Failed to delete notification on server:', error);
        
        // If DELETE fails (network), add to offline mutations
        if (!error?.message?.includes('404') && error?.status !== 404) {
          try {
            await db.offlineMutations.add({
              url: `/notifications/${id}`,
              method: 'DELETE',
              body: {},
              timestamp: Date.now(),
              retryCount: 0
            });
            console.log('Added offline mutation for delete notification:', id);
          } catch (dbError) {
            console.error('Failed to save offline mutation:', dbError);
          }
        }
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
        // On error, we might want to refresh to get true state
        // fetchNotifications(); // Disabling auto-fetch on error to prevent loops
      }
    }
  };

  const deleteNotification = async (id: string) => {
    locallyDeletedIds.current.add(id);
    setNotifications(prev => prev.filter(n => n.id !== id));
    
    try {
      await apiDeleteNotification(id);
    } catch (error: any) {
      console.error('Failed to delete notification on server:', error);
      
      // Add to offline mutations so sync manager can pick it up
      if (!error?.message?.includes('404') && error?.status !== 404) {
        try {
          await db.offlineMutations.add({
            url: `/notifications/${id}`,
            method: 'DELETE',
            body: {},
            timestamp: Date.now(),
            retryCount: 0
          });
          console.log('Added offline mutation for delete notification:', id);
        } catch (dbError) {
          console.error('Failed to save offline mutation:', dbError);
        }
      }
    }
  };

  const deleteNotifications = async (ids: string[]) => {
    ids.forEach(id => locallyDeletedIds.current.add(id));
    setNotifications(prev => prev.filter(n => !ids.includes(n.id)));
    
    try {
      await apiDeleteNotifications(ids);
    } catch (error: any) {
      console.error('Failed to delete notifications on server:', error);
      
      try {
        await db.offlineMutations.add({
          url: '/notifications',
          method: 'DELETE',
          body: { ids },
          timestamp: Date.now(),
          retryCount: 0
        });
        console.log('Added offline mutation for batch delete notifications');
      } catch (dbError) {
        console.error('Failed to save offline mutation:', dbError);
      }
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
