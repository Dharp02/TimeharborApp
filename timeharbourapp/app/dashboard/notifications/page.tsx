'use client';

import { useNotifications } from '@/contexts/NotificationContext';
import { formatDistanceToNow } from 'date-fns';
import { CheckCheck, Trash2, Bell, MessageSquare, Info, AlertTriangle, X } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function NotificationsPage() {
  const { notifications, markAsRead, markAllAsRead, unreadCount, refreshNotifications } = useNotifications();
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    refreshNotifications();
  }, [refreshNotifications]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'success':
        return <CheckCheck className="w-5 h-5 text-green-500" />;
      case 'message':
        return <MessageSquare className="w-5 h-5 text-blue-500" />;
      default:
        return <Info className="w-5 h-5 text-gray-500" />;
    }
  };

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const selectAll = () => {
    setSelectedIds(new Set(notifications.map(n => n.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const deleteSelected = () => {
    // TODO: Implement delete functionality in NotificationContext
    console.log('Delete notifications:', Array.from(selectedIds));
    setSelectedIds(new Set());
    setSelectionMode(false);
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const allSelected = notifications.length > 0 && selectedIds.size === notifications.length;

  return (
    <div className="md:max-w-4xl md:mx-auto">
      {/* Filter Bar */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2.5 flex items-center gap-2 -mx-4 mb-0 md:mx-0 md:rounded-t-xl md:border-l md:border-r md:border-t">
        {!selectionMode ? (
          <>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/40 transition-colors"
              >
                <CheckCheck className="w-4 h-4" />
                Mark all read
              </button>
            )}
            <button
              onClick={() => setSelectionMode(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Select
            </button>
          </>
        ) : (
          <>
            <button
              onClick={exitSelectionMode}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {selectedIds.size} selected
            </span>
            <div className="flex-1"></div>
            <button
              onClick={allSelected ? deselectAll : selectAll}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              {allSelected ? 'Deselect' : 'Select All'}
            </button>
            {selectedIds.size > 0 && (
              <button
                onClick={deleteSelected}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </>
        )}
      </div>

      {/* Notifications List */}
      {notifications.length === 0 ? (
        <div className="py-20 px-4 text-center text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 -mx-4 md:mx-0 md:rounded-b-xl md:border-l md:border-r md:border-b">
          <Bell className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <p className="text-lg font-semibold">No notifications yet</p>
          <p className="text-sm mt-2 text-gray-400 dark:text-gray-500">We'll notify you when something important happens</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800 -mx-4 md:mx-0 md:rounded-b-xl md:border-l md:border-r md:border-b">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`px-4 py-3.5 transition-colors ${
                notification.unread ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
              } ${!selectionMode ? 'active:bg-gray-100 dark:active:bg-gray-700/50' : ''}`}
              onClick={() => {
                if (selectionMode) {
                  toggleSelection(notification.id);
                } else if (notification.unread) {
                  markAsRead(notification.id);
                }
              }}
            >
              <div className="flex gap-3">
                {selectionMode && (
                  <div className="flex items-start pt-1">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(notification.id)}
                      onChange={() => toggleSelection(notification.id)}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                )}
                <div className="flex-shrink-0 pt-0.5">
                  {getIcon(notification.type || 'info')}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-3 mb-1">
                    <p className={`text-sm font-semibold leading-tight ${
                      notification.unread ? 'text-gray-900 dark:text-gray-100' : 'text-gray-600 dark:text-gray-400'
                    }`}>
                      {notification.title}
                    </p>
                    <span className="text-[11px] text-gray-400 dark:text-gray-500 whitespace-nowrap flex-shrink-0 pt-0.5">
                      {formatDistanceToNow(notification.timestamp, { addSuffix: true }).replace('about ', '')}
                    </span>
                  </div>
                  <p className={`text-sm leading-relaxed ${
                    notification.unread ? 'text-gray-700 dark:text-gray-300' : 'text-gray-500 dark:text-gray-500'
                  }`}>
                    {notification.message}
                  </p>
                </div>
                {notification.unread && !selectionMode && (
                  <div className="flex items-start pt-2 flex-shrink-0">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
