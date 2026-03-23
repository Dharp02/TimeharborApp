'use client';

import { useEffect } from 'react';
import { syncManager } from '@/TimeharborAPI/SyncManager';
import NetworkDetector from '@/TimeharborAPI/NetworkDetector';

export default function SyncInitializer() {
  useEffect(() => {
    const detector = NetworkDetector.getInstance();
    detector.init();
    detector.setSyncHandler(() => syncManager.syncNow());

    syncManager.init();

    // Sync on pull-to-refresh
    const onRefresh = () => syncManager.syncNow();
    window.addEventListener('pull-to-refresh', onRefresh);

    // Periodic sync every 5 minutes
    const interval = setInterval(() => {
      if (detector.getStatus() === 'online') {
        syncManager.syncNow();
      }
    }, 5 * 60 * 1000);

    // Initial sync
    syncManager.syncNow();

    return () => {
      window.removeEventListener('pull-to-refresh', onRefresh);
      clearInterval(interval);
      detector.destroy();
    };
  }, []);

  return null;
}
