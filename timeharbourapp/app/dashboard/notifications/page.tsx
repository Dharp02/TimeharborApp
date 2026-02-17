'use client';

import { useNotifications } from '@/contexts/NotificationContext';
import { Check, Trash2, Bell, Clock } from 'lucide-react';
import Link from 'next/link';

export default function NotificationsPage() {
  const { notifications, markAllAsRead, markAsRead, clearAll, unreadCount } = useNotifications();

  const handleMarkAsRead = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    markAsRead(id);
  };

  const formatTime = (timestamp: number) => {
    const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
    const diff = (timestamp - Date.now()) / 1000; // seconds
    const minutes = Math.round(diff / 60);
    const hours = Math.round(minutes / 60);
    const days = Math.round(hours / 24);

    if (Math.abs(minutes) < 60) return rtf.format(minutes, 'minute');
    if (Math.abs(hours) < 24) return rtf.format(hours, 'hour');
    return rtf.format(days, 'day');
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-3xl mx-auto w-full px-4 py-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              Notifications
              {unreadCount > 0 && (
                <span className="bg-blue-600 text-white text-xs px-2.5 py-1 rounded-full font-medium shadow-sm shadow-blue-200 dark:shadow-none">
                  {unreadCount}
                </span>
              )}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
              Manage your alerts and updates
            </p>
          </div>
          
          {notifications.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={markAllAsRead}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors shadow-sm"
              >
                <Check className="w-4 h-4" />
                Mark all read
              </button>
              <button
                onClick={clearAll}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors shadow-sm"
              >
                <Trash2 className="w-4 h-4" />
                Clear all
              </button>
            </div>
          )}
        </div>

        {/* Notifications List */}
        <div className="space-y-4">
          {notifications.length > 0 ? (
            notifications.map((notification) => (
              <div 
                key={notification.id} 
                onClick={() => markAsRead(notification.id)}
                className={`group relative overflow-hidden bg-white dark:bg-gray-800 rounded-2xl p-5 border transition-all duration-200 cursor-pointer hover:shadow-md
                  ${notification.unread 
                    ? 'border-blue-200 dark:border-blue-900/30 ring-1 ring-blue-50 dark:ring-blue-900/10' 
                    : 'border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700'
                  }
                `}
              >
                {/* Unread Indicator */}
                {notification.unread && (
                  <div className="absolute top-5 right-5 w-2.5 h-2.5 bg-blue-500 rounded-full ring-4 ring-blue-50 dark:ring-blue-900/20" />
                )}

                <div className="flex gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-colors
                    ${notification.unread 
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' 
                      : 'bg-gray-50 dark:bg-gray-700/50 text-gray-400 dark:text-gray-500'
                    }
                  `}>
                    <Bell className="w-5 h-5" />
                  </div>
                  
                  <div className="flex-1 min-w-0 pr-6">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className={`font-semibold text-base truncate ${
                        notification.unread 
                          ? 'text-gray-900 dark:text-white' 
                          : 'text-gray-700 dark:text-gray-300'
                      }`}>
                        {notification.title}
                      </h3>
                      <span className="text-gray-400 dark:text-gray-600 mx-1">•</span>
                      <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1 flex-shrink-0">
                         <Clock className="w-3 h-3" />
                         {formatTime(notification.timestamp)}
                      </span>
                    </div>
                    
                    <p className={`text-sm leading-relaxed ${
                       notification.unread 
                         ? 'text-gray-600 dark:text-gray-300'
                         : 'text-gray-500 dark:text-gray-400'
                    }`}>
                      {notification.message}
                    </p>

                    {notification.unread && (
                        <div className="mt-3 flex items-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                             <button 
                                onClick={(e) => handleMarkAsRead(notification.id, e)}
                                className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1.5"
                             >
                                 <Check className="w-3.5 h-3.5" />
                                 Mark as read
                             </button>
                        </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-gray-800 rounded-3xl border border-dashed border-gray-200 dark:border-gray-700 text-center">
              <div className="w-20 h-20 bg-gray-50 dark:bg-gray-700/50 rounded-full flex items-center justify-center mb-6 ring-8 ring-gray-50/50 dark:ring-gray-700/20">
                 <Bell className="w-10 h-10 text-gray-300 dark:text-gray-500" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                All caught up!
              </h3>
              <p className="text-gray-500 dark:text-gray-400 max-w-sm">
                You have no new notifications at the moment. We'll verify you when something important happens.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
