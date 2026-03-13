'use client';

import { useNotifications } from '@/contexts/NotificationContext';
import type { AppNotification } from '@/contexts/NotificationContext';
import { formatDistanceToNow } from 'date-fns';
import { CheckCheck, Trash2, Bell, MessageSquare, Info, AlertTriangle, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTeam } from '@/components/dashboard/TeamContext';
import { Button, Checkbox } from '@mieweb/ui';

export default function NotificationsPage() {
  const { notifications, markAsRead, markAllAsRead, unreadCount, refreshNotifications, deleteNotifications } = useNotifications();
  const { currentTeam } = useTeam();
  const [selectionMode, setSelectionMode] = useState(false);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const router = useRouter();

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
        return <MessageSquare className="w-5 h-5 text-primary-500" />;
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

  const deleteSelected = async () => {
    const idsToDelete = Array.from(selectedIds);
    await deleteNotifications(idsToDelete);
    setSelectedIds(new Set());
    setSelectionMode(false);
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const handleNotificationClick = (notification: AppNotification) => {
    if (selectionMode) {
      toggleSelection(notification.id);
      return;
    }

    // Mark as read and auto-delete
    markAsRead(notification.id, true); // Auto-delete on read

    // Navigate to member profile if data contains member information AND user is a leader
    if (notification.data?.memberId && currentTeam?.role === 'Leader') {
      const { memberId, memberName, teamId } = notification.data;
      const memberUrl = `/dashboard/member?id=${memberId}${teamId ? `&teamId=${teamId}` : ''}${memberName ? `&name=${encodeURIComponent(memberName)}` : ''}`;
      router.push(memberUrl);
    }
  };

  const allSelected = notifications.length > 0 && selectedIds.size === notifications.length;

  return (
    <div className="md:max-w-4xl md:mx-auto">
      {/* Filter Bar */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2.5 flex items-center gap-2 -mx-4 mb-0 md:mx-0 md:rounded-t-xl md:border-l md:border-r md:border-t">
        {!selectionMode ? (
          <>
            {unreadCount > 0 && (
              <Button
                onClick={markAllAsRead}
                variant="secondary"
                size="sm"
                leftIcon={<CheckCheck className="w-4 h-4" />}
                className="text-primary-600 dark:text-primary-400"
              >
                Mark all read
              </Button>
            )}
            <Button
              onClick={() => setSelectionMode(true)}
              variant="ghost"
              size="sm"
            >
              Select
            </Button>
          </>
        ) : (
          <>
            <Button
              onClick={exitSelectionMode}
              variant="ghost"
              size="icon"
              aria-label="Exit selection mode"
            >
              <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </Button>
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {selectedIds.size} selected
            </span>
            <div className="flex-1"></div>
            <Button
              onClick={allSelected ? deselectAll : selectAll}
              variant="ghost"
              size="sm"
            >
              {allSelected ? 'Deselect' : 'Select All'}
            </Button>
            {selectedIds.size > 0 && (
              <Button
                onClick={deleteSelected}
                variant="danger"
                size="sm"
                leftIcon={<Trash2 className="w-4 h-4" />}
              >
                Delete
              </Button>
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
              className={`px-4 py-3.5 transition-colors cursor-pointer ${
                notification.unread ? 'bg-primary-50/50 dark:bg-primary-900/10' : ''
              } ${!selectionMode ? 'active:bg-gray-100 dark:active:bg-gray-700/50' : ''}`}
              onClick={() => handleNotificationClick(notification)}
            >
              <div className="flex gap-3">
                {selectionMode && (
                  <div className="flex items-start pt-1">
                    <Checkbox
                      aria-label="Select notification"
                      checked={selectedIds.has(notification.id)}
                      onChange={() => toggleSelection(notification.id)}
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
                    <div className="w-2 h-2 bg-primary-500 rounded-full"></div>
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
