'use client';

import { useEffect, useRef, useCallback } from 'react';
import { syncManager } from '@/TimeharborAPI/SyncManager';
import NetworkDetector from '@/TimeharborAPI/NetworkDetector';
import { useToast } from '@mieweb/ui';
import { Capacitor } from '@capacitor/core';

export default function SyncInitializer() {
  const toast = useToast();
  // Use refs so the effect closures always call the latest toast functions
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const wasOfflineRef = useRef(false);
  const initialSyncDoneRef = useRef(false);

  const showSyncedToast = useCallback(() => {
    toastRef.current.success('Data synced successfully');
  }, []);

  const showOfflineToast = useCallback(() => {
    toastRef.current.warning('You are offline');
  }, []);

  const showOnlineToast = useCallback(() => {
    toastRef.current.info('Back online — syncing…');
  }, []);

  useEffect(() => {
    const detector = NetworkDetector.getInstance();
    detector.init();

    detector.setSyncHandler(async () => {
      await syncManager.syncNow();
      // Show toast when reconnecting (offline → online)
      if (wasOfflineRef.current) {
        wasOfflineRef.current = false;
        showSyncedToast();
      } else if (!initialSyncDoneRef.current) {
        // Show a subtle confirmation on the very first sync
        initialSyncDoneRef.current = true;
      }
    });

    syncManager.init();

    // Track offline → online transitions
    const handleOffline = () => {
      wasOfflineRef.current = true;
      showOfflineToast();
    };
    const handleOnline = () => {
      showOnlineToast();
      // Trigger sync — the sync handler will show "Data synced" toast
      syncManager.syncNow();
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    // Capacitor: use native Network plugin for more reliable detection
    let networkListenerCleanup: (() => void) | null = null;
    if (Capacitor.isNativePlatform()) {
      import('@capacitor/network').then(({ Network }) => {
        Network.addListener('networkStatusChange', (status) => {
          if (status.connected) {
            if (wasOfflineRef.current) {
              showOnlineToast();
              syncManager.syncNow();
            }
          } else {
            wasOfflineRef.current = true;
            showOfflineToast();
          }
        });
        networkListenerCleanup = () => Network.removeAllListeners();
      }).catch(() => { /* Network plugin not available */ });
    }

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
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('pull-to-refresh', onRefresh);
      networkListenerCleanup?.();
      clearInterval(interval);
      detector.destroy();
    };
  }, [showSyncedToast, showOfflineToast, showOnlineToast]);

  return null;
}
