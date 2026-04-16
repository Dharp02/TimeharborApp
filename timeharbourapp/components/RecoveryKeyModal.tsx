'use client';

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useRefresh } from '@/contexts/RefreshContext';
import { Button, Alert, AlertDescription, Input } from '@mieweb/ui';
import { Upload, ShieldCheck, AlertTriangle, KeyRound } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import {
  buildRecoveryKey,
  parseRecoveryKey,
  markRecoveryKeySaved,
  saveToCredentialManager,
  loadFromCredentialManager,
  isCredentialManagerAvailable,
  isNativeKeychainAvailable,
  saveToNativeKeychain,
  loadFromNativeKeychain,
} from '@/TimeharborAPI/sync/RecoveryKeyService';
import {
  setIdentityUUID,
  setIdentityPassphrase,
} from '@/TimeharborAPI/sync/IdentityManager';
import {
  setupEncryption,
  clearKeys,
  cacheSyncKey,
} from '@/TimeharborAPI/sync/KeyManager';
import {
  verifySyncKey,
  resetOpLogCursor,
  pullOpLog,
  hasServerData,
} from '@/TimeharborAPI/sync/EncryptedSyncEngine';
import { syncManager } from '@/TimeharborAPI/SyncManager';
import { clearDatabase } from '@/TimeharborAPI/db';
import { resetTicketState } from '@/TimeharborAPI/tickets';

interface RecoveryKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'save' | 'restore';
}

export default function RecoveryKeyModal({ isOpen, onClose, mode }: RecoveryKeyModalProps) {
  const router = useRouter();
  const { refreshAll } = useRefresh();
  
  // ── Save mode state ──
  const [saveStep, setSaveStep] = useState<'confirm' | 'saving' | 'done'>('confirm');

  // ── Restore mode state ──
  const [inputKey, setInputKey] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [restoreStep, setRestoreStep] = useState<'input' | 'restoring' | 'done'>('input');
  const [pulledCount, setPulledCount] = useState(0);

  // ── Shared state ──
  const [error, setError] = useState('');

  // ── Save: push recovery key to native keychain or browser credential manager ──
  const handleSave = useCallback(async () => {
    setError('');
    setSaveStep('saving');

    try {
      if (isNativeKeychainAvailable()) {
        await saveToNativeKeychain();
      } else {
        await saveToCredentialManager();
      }
      await markRecoveryKeySaved();
      setSaveStep('done');
    } catch (err: any) {
      if (err?.message === 'CREDENTIAL_MANAGER_UNAVAILABLE') {
        setError(
          'Your browser does not support saving credentials. ' +
          'Please use Chrome, Edge, or a Chromium-based browser to save your recovery key.',
        );
      } else {
        setError(err?.message || 'Failed to save recovery key.');
      }
      setSaveStep('confirm');
    }
  }, []);

  // ── Restore: load from native keychain / credential manager or manual input ──
  const handleRestoreFromBrowser = useCallback(async () => {
    setError('');

    try {
      const key = isNativeKeychainAvailable()
        ? await loadFromNativeKeychain()
        : await loadFromCredentialManager();

      if (key) {
        setInputKey(key);
      } else {
        setError('No recovery key found. Enter it manually below.');
      }
    } catch {
      setError('Could not access stored credentials. Enter your key manually.');
    }
  }, []);

  const handleRestore = useCallback(async () => {
    setError('');
    setRestoring(true);
    setRestoreStep('restoring');
    setPulledCount(0);

    try {
      // 1. Parse the recovery key
      const { uuid, passphrase } = parseRecoveryKey(inputKey);

      // 2. Stop any in-flight sync before switching identity
      await syncManager.stop();

      // 3. Set the identity UUID and passphrase from the recovery key
      setIdentityUUID(uuid);
      setIdentityPassphrase(passphrase);

      // 4. Setup encryption BEFORE clearing DB so we can verify first
      let syncKey = await setupEncryption(passphrase);

      // 5. Verify the key can decrypt server data
      try {
        await verifySyncKey(syncKey);
      } catch (verifyErr: any) {
        // Wrong key — clear everything and revert identity
        await clearKeys();
        localStorage.removeItem('th_identity_uuid');
        localStorage.removeItem('th_identity_passphrase');
        throw new Error(
          verifyErr?.name === 'OperationError'
            ? 'Recovery key is invalid or does not match server data.'
            : verifyErr?.message || 'Failed to verify recovery key.',
        );
      }

      // 6. Check if server has any data for this identity
      const serverHasData = await hasServerData();
      if (!serverHasData) {
        await clearKeys();
        localStorage.removeItem('th_identity_uuid');
        localStorage.removeItem('th_identity_passphrase');
        throw new Error(
          'No synced data found on the server for this recovery key. ' +
          'Data must have been synced at least once before it can be restored.',
        );
      }

      // 7. Clear local database and keys from the previous profile
      await clearDatabase();
      resetTicketState();

      // 8. Re-derive keys after DB wipe (clearDatabase wiped deviceKeys/cachedKeys)
      syncKey = await setupEncryption(passphrase);
      await cacheSyncKey(syncKey);
      syncManager.setSyncKey(syncKey);

      // 9. Resume sync and pull ALL data for the restored identity
      syncManager.resume();
      const pulled = await pullOpLog(syncKey, { includeOwn: true });
      setPulledCount(pulled);

      // 10. Notify UI that data changed
      if (typeof window !== 'undefined' && pulled > 0) {
        window.dispatchEvent(new Event('sync-complete'));
      }

      setRestoreStep('done');
    } catch (err: any) {
      setError(err?.message || 'Restore failed.');
      setRestoreStep('input');
      // Re-enable sync in case it was stopped
      syncManager.resume();
    } finally {
      setRestoring(false);
    }
  }, [inputKey]);

  const handleClose = useCallback(() => {
    // After a successful restore, reload to reset all in-memory state
    if (restoreStep === 'done') {
      refreshAll();
      router.push('/dashboard');
      router.refresh();
      return;
    }
    setSaveStep('confirm');
    setInputKey('');
    setError('');
    setRestoreStep('input');
    setPulledCount(0);
    onClose();
  }, [onClose, restoreStep, refreshAll, router]);

  const isNative = isNativeKeychainAvailable();
  const canSaveKey = isNative || isCredentialManagerAvailable();

  return (
    <Modal
      isOpen={isOpen}
      onClose={restoring || saveStep === 'saving' ? () => {} : handleClose}
      title={mode === 'save' ? 'Save Recovery Key' : 'Restore from Recovery Key'}
    >
      <div className="flex flex-col gap-4">
        {/* ── Save Mode: Confirm ── */}
        {mode === 'save' && saveStep === 'confirm' && (
          <>
            <Alert aria-live="polite">
              <ShieldCheck className="w-4 h-4" />
              <AlertDescription>
                {isNative
                  ? 'Your recovery key will be saved securely to your device\u2019s Keychain. It stays on your device and is protected by your device passcode and biometrics.'
                  : 'Your recovery key will be saved to your browser\u2019s password manager (Google Password Manager, iCloud Keychain, or Microsoft Autofill depending on your browser). It syncs automatically with your cloud account.'}
              </AlertDescription>
            </Alert>

            <p className="text-sm text-muted-foreground">
              {isNative
                ? 'You will need this key to restore your data if you reinstall the app or switch devices.'
                : 'You will need this key to restore your data if you lose your device or reinstall the app. The key is never shown as text \u2014 it goes directly into your browser\u2019s secure storage.'}
            </p>

            {error && (
              <Alert variant="danger" aria-live="polite">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              onClick={handleSave}
              disabled={!canSaveKey}
              className="w-full"
            >
              <KeyRound className="w-4 h-4 mr-2" />
              {isNative ? 'Save to Keychain' : 'Save to Password Manager'}
            </Button>

            {!canSaveKey && (
              <Alert variant="danger" aria-live="polite">
                <AlertTriangle className="w-4 h-4" />
                <AlertDescription>
                  Your browser does not support the Credential Management API.
                  Please use Chrome, Edge, or another Chromium-based browser.
                </AlertDescription>
              </Alert>
            )}

            <Button variant="outline" onClick={handleClose} className="w-full">
              Cancel
            </Button>
          </>
        )}

        {/* ── Save Mode: Saving spinner ── */}
        {mode === 'save' && saveStep === 'saving' && (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">
              {isNative
                ? 'Saving to your device\u2019s Keychain\u2026'
                : 'Saving to your browser\u2019s password manager\u2026'}
            </p>
          </div>
        )}

        {/* ── Save Mode: Done ── */}
        {mode === 'save' && saveStep === 'done' && (
          <>
            <div className="flex flex-col items-center gap-3 py-4">
              <ShieldCheck className="w-10 h-10 text-green-500" />
              <p className="text-sm text-center text-muted-foreground">
                {isNative
                  ? 'Your recovery key has been saved to your device\u2019s Keychain.'
                  : 'Your recovery key has been saved to your browser\u2019s password manager. It will sync to your cloud account automatically.'}
              </p>
            </div>
            <Button onClick={handleClose} className="w-full">
              Done
            </Button>
          </>
        )}

        {/* ── Restore Mode: Input ── */}
        {mode === 'restore' && restoreStep === 'input' && (
          <>
            <p className="text-sm text-muted-foreground">
              Restore your data using your saved recovery key
              {isNative ? ' from device Keychain' : ' from your browser\u2019s password manager'},
              or enter it manually if you saved it elsewhere.
            </p>

            <Alert variant="danger" aria-live="polite">
              <AlertTriangle className="w-4 h-4" />
              <AlertDescription>
                This will replace your current local identity. Any data not yet synced
                on this device will be lost.
              </AlertDescription>
            </Alert>

            {canSaveKey && (
              <Button
                variant="outline"
                onClick={handleRestoreFromBrowser}
                className="w-full"
              >
                <KeyRound className="w-4 h-4 mr-2" />
                {isNative ? 'Load from Keychain' : 'Load from Password Manager'}
              </Button>
            )}

            <div className="flex flex-col gap-2">
              <label htmlFor="restore-key-input" className="text-sm font-medium">
                Recovery Key
              </label>
              <Input
                id="restore-key-input"
                value={inputKey}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInputKey(e.target.value)}
                placeholder="TH1-..."
                className="font-mono text-xs"
                autoFocus={!canSaveKey}
                aria-label="Recovery key input"
              />
            </div>

            {error && (
              <Alert variant="danger" aria-live="polite">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              onClick={handleRestore}
              disabled={!inputKey.trim()}
              className="w-full"
            >
              <Upload className="w-4 h-4 mr-2" />
              Restore Data
            </Button>
            <Button variant="outline" onClick={handleClose} className="w-full">
              Cancel
            </Button>
          </>
        )}

        {/* ── Restore: spinner ── */}
        {mode === 'restore' && restoreStep === 'restoring' && (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">
              Restoring your data from the server…
            </p>
          </div>
        )}

        {/* ── Restore: done ── */}
        {mode === 'restore' && restoreStep === 'done' && (
          <>
            <div className="flex flex-col items-center gap-3 py-4">
              <ShieldCheck className="w-10 h-10 text-green-500" />
              <p className="text-sm text-center text-muted-foreground">
                {pulledCount > 0
                  ? `Restored ${pulledCount} entries from the server. Your identity and encryption keys are now set up on this device.`
                  : 'Your identity and encryption keys are set up, but no data entries were found on the server. If you expected data, it may not have been synced from the original device.'}
              </p>
            </div>
            <Button onClick={handleClose} className="w-full">
              Done
            </Button>
          </>
        )}
      </div>
    </Modal>
  );
}
