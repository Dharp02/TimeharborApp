'use client';

import { useEffect } from 'react';
import { syncManager } from '@/TimeharborAPI/SyncManager';
import { usePushNotifications } from '@/hooks/usePushNotifications';

export default function SyncInitializer() {
  // Initialize push notifications
  usePushNotifications();

  useEffect(() => {
    // Initialize the sync manager (which initializes NetworkDetector)
    syncManager.init();
  }, []);

  return null;
}
