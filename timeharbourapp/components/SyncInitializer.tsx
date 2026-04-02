'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { syncManager } from '@/TimeharborAPI/SyncManager';
import NetworkDetector from '@/TimeharborAPI/NetworkDetector';
import { useToast } from '@mieweb/ui';
import { Capacitor } from '@capacitor/core';
import {
  isEncryptionSetUp,
  setupEncryption,
  unlockEncryption,
} from '@/TimeharborAPI/sync/KeyManager';
import {
  isMigrated,
  runMigration,
} from '@/TimeharborAPI/sync/MigrationService';
import EncryptionSetupModal from './EncryptionSetupModal';

export default function SyncInitializer() {
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const wasOfflineRef = useRef(false);
  const initialSyncDoneRef = useRef(false);

  // ── Encryption setup state ──
  const [showPassphraseModal, setShowPassphraseModal] = useState(false);
  const [passphraseMode, setPassphraseMode] = useState<'setup' | 'unlock'>('setup');

  const showSyncedToast = useCallback(() => {
    toastRef.current.success('Data synced successfully');
  }, []);

  const showOfflineToast = useCallback(() => {
    toastRef.current.warning('You are offline');
  }, []);

  const showOnlineToast = useCallback(() => {
    toastRef.current.info('Back online — syncing…');
  }, []);

  // ── Handle passphrase submission (setup or unlock) ──
  const handlePassphraseSubmit = useCallback(async (passphrase: string) => {
    const alreadySetUp = await isEncryptionSetUp();

    let syncKey: CryptoKey;
    if (alreadySetUp) {
      syncKey = await unlockEncryption(passphrase);
    } else {
      syncKey = await setupEncryption(passphrase);
    }

    // Hand the key to the SyncManager
    syncManager.setSyncKey(syncKey);
    setShowPassphraseModal(false);

    // If migration hasn't run yet, run it now
    const migrated = await isMigrated();
    if (!migrated) {
      toastRef.current.info('Migrating data to encrypted sync…');
      await runMigration((step, total, desc) => {
        console.log(`Migration ${step}/${total}: ${desc}`);
      });
      toastRef.current.success('Migration complete');
    }

    // Trigger an immediate sync now that we have the key
    syncManager.syncNow();
  }, []);

  useEffect(() => {
    const detector = NetworkDetector.getInstance();
    detector.init();

    detector.setSyncHandler(async () => {
      await syncManager.syncNow();
      if (wasOfflineRef.current) {
        wasOfflineRef.current = false;
        showSyncedToast();
      } else if (!initialSyncDoneRef.current) {
        initialSyncDoneRef.current = true;
      }
    });

    syncManager.init();

    // Listen for the SyncManager telling us it needs encryption setup
    const handleEncryptionNeeded = async () => {
      const alreadySetUp = await isEncryptionSetUp();
      setPassphraseMode(alreadySetUp ? 'unlock' : 'setup');
      setShowPassphraseModal(true);
    };
    syncManager.onEncryptionNeeded(handleEncryptionNeeded);

    // Track offline → online transitions
    const handleOffline = () => {
      wasOfflineRef.current = true;
      showOfflineToast();
    };
    const handleOnline = () => {
      showOnlineToast();
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

    // ── Boot sequence: check encryption state, then initial sync ──
    (async () => {
      try {
        const hasKeys = await isEncryptionSetUp();
        if (hasKeys) {
          // Prompt for passphrase to unlock
          setPassphraseMode('unlock');
          setShowPassphraseModal(true);
        } else {
          // First time — prompt to set up
          setPassphraseMode('setup');
          setShowPassphraseModal(true);
        }
      } catch {
        // Prompt for setup as fallback
        setPassphraseMode('setup');
        setShowPassphraseModal(true);
      }
    })();

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('pull-to-refresh', onRefresh);
      syncManager.offEncryptionNeeded(handleEncryptionNeeded);
      networkListenerCleanup?.();
      clearInterval(interval);
      detector.destroy();
    };
  }, [showSyncedToast, showOfflineToast, showOnlineToast, handlePassphraseSubmit]);

  return (
    <EncryptionSetupModal
      isOpen={showPassphraseModal}
      mode={passphraseMode}
      onSubmit={handlePassphraseSubmit}
    />
  );
}
