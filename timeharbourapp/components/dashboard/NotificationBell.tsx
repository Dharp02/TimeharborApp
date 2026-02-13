'use client';

import { Bell } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

export default function NotificationBell({ isMobile = false }) {
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);

  // Close notifications when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Placeholder notifications
  const notifications = [
    { id: 1, title: 'Session ended', message: 'Your session was automatically ended after 8 hours.', time: '2 hours ago', unread: true },
    { id: 2, title: 'New team member', message: 'Sarah joined the Design Team.', time: '5 hours ago', unread: false },
    { id: 3, title: 'Ticket assigned', message: 'You were assigned to ticket #TH-102.', time: 'Yesterday', unread: false },
  ];

  const unreadCount = notifications.filter(n => n.unread).length;

  return (
    <div className="relative" ref={notificationRef}>
      <button
        onClick={() => setShowNotifications(!showNotifications)}
        className={`p-2 rounded-lg transition-colors relative ${
          showNotifications 
            ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' 
            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
        }`}
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white dark:ring-gray-800" />
        )}
      </button>

      {/* Notification Dropdown */}
      {showNotifications && (
        <div className={`absolute mt-2 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-in fade-in zoom-in-95 duration-200 z-50 origin-top-right
            ${isMobile 
              ? 'fixed top-16 right-4 w-[calc(100vw-32px)] max-w-sm' 
              : 'right-0 w-80'
            }
        `}>
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-white dark:bg-gray-800 sticky top-0 z-10">
            <h3 className="font-semibold text-gray-900 dark:text-white">Notifications</h3>
            {unreadCount > 0 && (
              <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full font-medium">
                {unreadCount} New
              </span>
            )}
          </div>
          <div className="max-h-[320px] overflow-y-auto">
            {notifications.length > 0 ? (
              notifications.map((notification) => (
                <div 
                  key={notification.id} 
                  className={`p-4 border-b border-gray-50 dark:border-gray-750 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors cursor-pointer ${
                    notification.unread ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <h4 className={`text-sm font-medium ${notification.unread ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                      {notification.title}
                    </h4>
                    <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap ml-2">
                      {notification.time}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                    {notification.message}
                  </p>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400 text-sm">
                No new notifications
              </div>
            )}
          </div>
          <div className="p-2 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <button className="w-full py-1.5 text-xs font-medium text-center text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors">
              Mark all as read
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
