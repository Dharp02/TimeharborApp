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
  clearKeys,
  cacheSyncKey,
  loadCachedSyncKey,
} from '@/TimeharborAPI/sync/KeyManager';
import {
  isMigrated,
  runMigration,
} from '@/TimeharborAPI/sync/MigrationService';
import {
  hasServerData,
  verifySyncKey,
} from '@/TimeharborAPI/sync/EncryptedSyncEngine';
import {
  ensureIdentityAndEncryption,
  migrateAuthUserIdToIdentity,
  getIdentityUUID,
} from '@/TimeharborAPI/sync/IdentityManager';
import { ensureCurrentProfileSaved } from '@/TimeharborAPI/sync/ProfileRegistry';
import { db, getCurrentDatabaseName } from '@/TimeharborAPI/db';
import EncryptionSetupModal from './EncryptionSetupModal';

export default function SyncInitializer() {
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const wasOfflineRef = useRef(false);
  const initialSyncDoneRef = useRef(false);

  // ── Encryption setup state (only used for restore mode) ──
  const [showPassphraseModal, setShowPassphraseModal] = useState(false);
  const [passphraseMode, setPassphraseMode] = useState<'setup' | 'unlock' | 'restore'>('restore');

  const showSyncedToast = useCallback(() => {
    toastRef.current.success('Data synced successfully');
  }, []);

  const showOfflineToast = useCallback(() => {
    toastRef.current.warning('You are offline');
  }, []);

  const showOnlineToast = useCallback(() => {
    toastRef.current.info('Back online — syncing…');
  }, []);

  const logIdentityDbContext = useCallback((stage: string) => {
    if (typeof window === 'undefined') return;

    const uuid = getIdentityUUID();
    const activeDbName = getCurrentDatabaseName();
    const expectedDbName = uuid ? `TimeharborDB_${uuid}` : 'TimeharborDB';

    if (activeDbName !== expectedDbName) {
      console.warn('[SyncInitializer] identity/db mismatch', {
        stage,
        uuid,
        activeDbName,
        expectedDbName,
      });
      return;
    }

    console.info('[SyncInitializer] startup identity/db context', {
      stage,
      uuid,
      activeDbName,
    });
  }, []);

  // ── Handle passphrase submission (setup, unlock, or restore) ──
  const handlePassphraseSubmit = useCallback(async (passphrase: string) => {
    const alreadySetUp = await isEncryptionSetUp();

    let syncKey: CryptoKey;
    if (alreadySetUp) {
      syncKey = await unlockEncryption(passphrase);
    } else {
      // Both 'setup' (new user) and 'restore' (existing user, new device)
      // use setupEncryption — the deterministic salt ensures the same
      // passphrase produces the same sync key across devices.
      syncKey = await setupEncryption(passphrase);
    }

    // In restore mode, verify the passphrase can decrypt existing server data
    // before committing.  If wrong, verifySyncKey throws OperationError which
    // the modal catches and shows "Incorrect passphrase".
    if (passphraseMode === 'restore') {
      try {
        await verifySyncKey(syncKey);
      } catch (err) {
        // Clear the keys that setupEncryption just stored so the user can retry
        await clearKeys();
        throw err;
      }
    }

    // Hand the key to the SyncManager and cache it for future page loads
    syncManager.setSyncKey(syncKey);
    await cacheSyncKey(syncKey);
    setShowPassphraseModal(false);

    // After sign-out → sign-in or restore, the local DB was wiped so we
    // need to pull ALL server batches including this device's own.
    if (passphraseMode === 'restore' || passphraseMode === 'setup') {
      syncManager.requestFullRestore();
    }

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
    await syncManager.syncNow().catch(e => console.warn('Sync failed:', e));
  }, [passphraseMode]);

  useEffect(() => {
    const detector = NetworkDetector.getInstance();
    detector.init();

    detector.setSyncHandler(async () => {
      await syncManager.syncNow().catch(e => console.warn('Sync failed:', e));
      if (wasOfflineRef.current) {
        wasOfflineRef.current = false;
        showSyncedToast();
      } else if (!initialSyncDoneRef.current) {
        initialSyncDoneRef.current = true;
      }
    });

    syncManager.init();

    // Show a toast when any background sync cycle fails (e.g. HTTP 401/500).
    // This makes silent failures visible so users know to investigate.
    const handleSyncError = (err: Error) => {
      toastRef.current.error(`Sync failed: ${err.message}`);
    };
    syncManager.onSyncError(handleSyncError);

    // Listen for the SyncManager telling us it needs encryption setup.
    // Auto-setup silently; only show modal if auto-setup fails.
    const handleEncryptionNeeded = async () => {
      try {
        // Migrate any data stored under old auth user.id to identity UUID
        await migrateAuthUserIdToIdentity();
        const syncKey = await ensureIdentityAndEncryption();
        logIdentityDbContext('encryption-needed');
        ensureCurrentProfileSaved();
        syncManager.setSyncKey(syncKey);

        // If local DB is empty but server has data, do a full restore
        // (pulls this device's own batches too — needed after cache clear)
        const localCount = await db.opLog.count();
        if (localCount === 0) {
          const serverHasData = await hasServerData();
          if (serverHasData) {
            syncManager.requestFullRestore();
          }
        }

        syncManager.syncNow();
      } catch {
        // Auto-setup failed — show restore modal as fallback
        setPassphraseMode('restore');
        setShowPassphraseModal(true);
      }
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
            // Sync whenever connectivity is restored, regardless of whether
            // we previously saw an offline transition (covers app resume too).
            showOnlineToast();
            syncManager.syncNow();
            wasOfflineRef.current = false;
          } else {
            wasOfflineRef.current = true;
            showOfflineToast();
          }
        });
        networkListenerCleanup = () => Network.removeAllListeners();
      }).catch(() => { /* Network plugin not available */ });

      // Sync when the app returns to the foreground (e.g. user switches back
      // from another app). Without this, items can stay pending indefinitely
      // since the periodic timer and write-debounce only fire while active.
      import('@capacitor/app').then(({ App }) => {
        App.addListener('appStateChange', (state) => {
          if (state.isActive) {
            syncManager.syncNow();
          }
        });
        const prevCleanup = networkListenerCleanup;
        networkListenerCleanup = () => {
          prevCleanup?.();
          App.removeAllListeners();
        };
      }).catch(() => { /* App plugin not available */ });
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

    // ── Boot sequence: auto-setup encryption silently ──
    (async () => {
      try {
        // Auto-generate UUID + passphrase + encryption key on first launch.
        // If already set up, this just loads the cached key.
        const syncKey = await ensureIdentityAndEncryption();
        logIdentityDbContext('boot');
        syncManager.setSyncKey(syncKey);

        // If migration hasn't run yet, run it now
        const migrated = await isMigrated();
        if (!migrated) {
          toastRef.current.info('Migrating data to encrypted sync…');
          await runMigration((step, total, desc) => {
            console.log(`Migration ${step}/${total}: ${desc}`);
          });
          toastRef.current.success('Migration complete');
        }

        // Trigger initial sync
        syncManager.syncNow();
      } catch (err) {
        console.error('[SyncInitializer] auto-setup failed:', err);
        // Fallback: if auto-setup fails (e.g. corrupted keys), prompt for restore
        setPassphraseMode('restore');
        setShowPassphraseModal(true);
      }
    })();

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('pull-to-refresh', onRefresh);
      syncManager.offEncryptionNeeded(handleEncryptionNeeded);
      syncManager.offSyncError(handleSyncError);
      networkListenerCleanup?.();
      clearInterval(interval);
      detector.destroy();
    };
  }, [showSyncedToast, showOfflineToast, showOnlineToast, handlePassphraseSubmit, logIdentityDbContext]);

  return (
    <EncryptionSetupModal
      isOpen={showPassphraseModal}
      mode={passphraseMode}
      onSubmit={handlePassphraseSubmit}
    />
  );
}
