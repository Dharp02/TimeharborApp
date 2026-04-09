'use client';

import React, { useState, useCallback } from 'react';
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
} from '@/TimeharborAPI/sync/EncryptedSyncEngine';
import { syncManager } from '@/TimeharborAPI/SyncManager';

interface RecoveryKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'save' | 'restore';
}

export default function RecoveryKeyModal({ isOpen, onClose, mode }: RecoveryKeyModalProps) {
  // ── Save mode state ──
  const [saveStep, setSaveStep] = useState<'confirm' | 'saving' | 'done'>('confirm');

  // ── Restore mode state ──
  const [inputKey, setInputKey] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [restoreStep, setRestoreStep] = useState<'input' | 'restoring' | 'done'>('input');

  // ── Shared state ──
  const [error, setError] = useState('');

  // ── Save: push recovery key to browser credential manager ──
  const handleSave = useCallback(async () => {
    setError('');
    setSaveStep('saving');

    try {
      await saveToCredentialManager();
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

  // ── Restore: load from credential manager or manual input ──
  const handleRestoreFromBrowser = useCallback(async () => {
    setError('');

    try {
      const key = await loadFromCredentialManager();
      if (key) {
        setInputKey(key);
      } else {
        setError('No recovery key found in your browser. Enter it manually below.');
      }
    } catch {
      setError('Could not access browser credentials. Enter your key manually.');
    }
  }, []);

  const handleRestore = useCallback(async () => {
    setError('');
    setRestoring(true);
    setRestoreStep('restoring');

    try {
      // 1. Parse the recovery key
      const { uuid, passphrase } = parseRecoveryKey(inputKey);

      // 2. Set the identity UUID and passphrase from the recovery key
      setIdentityUUID(uuid);
      setIdentityPassphrase(passphrase);

      // 3. Clear any existing local keys (fresh start)
      await clearKeys();

      // 4. Setup encryption with the recovered passphrase
      //    (deterministic salt → same key as original device)
      const syncKey = await setupEncryption(passphrase);

      // 5. Verify the key can decrypt server data
      try {
        await verifySyncKey(syncKey);
      } catch (verifyErr: any) {
        // Wrong key — clear everything and revert
        await clearKeys();
        throw new Error(
          verifyErr?.name === 'OperationError'
            ? 'Recovery key is invalid or does not match server data.'
            : verifyErr?.message || 'Failed to verify recovery key.',
        );
      }

      // 6. Cache the sync key and wire it into the sync manager
      await cacheSyncKey(syncKey);
      syncManager.setSyncKey(syncKey);

      // 7. Reset the pull cursor so we pull ALL data from scratch
      await resetOpLogCursor();

      // 8. Request a full restore (pulls own batches too)
      syncManager.requestFullRestore();
      await syncManager.syncNow();

      setRestoreStep('done');
    } catch (err: any) {
      setError(err?.message || 'Restore failed.');
      setRestoreStep('input');
    } finally {
      setRestoring(false);
    }
  }, [inputKey]);

  const handleClose = useCallback(() => {
    setSaveStep('confirm');
    setInputKey('');
    setError('');
    setRestoreStep('input');
    onClose();
  }, [onClose]);

  const credManagerAvailable = isCredentialManagerAvailable();

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
                Your recovery key will be saved to your browser&apos;s password manager
                (Google Password Manager, iCloud Keychain, or Microsoft Autofill
                depending on your browser). It syncs automatically with your cloud account.
              </AlertDescription>
            </Alert>

            <p className="text-sm text-muted-foreground">
              You will need this key to restore your data if you lose your device
              or reinstall the app. The key is never shown as text — it goes
              directly into your browser&apos;s secure storage.
            </p>

            {error && (
              <Alert variant="danger" aria-live="polite">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              onClick={handleSave}
              disabled={!credManagerAvailable}
              className="w-full"
            >
              <KeyRound className="w-4 h-4 mr-2" />
              Save to Password Manager
            </Button>

            {!credManagerAvailable && (
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
              Saving to your browser&apos;s password manager…
            </p>
          </div>
        )}

        {/* ── Save Mode: Done ── */}
        {mode === 'save' && saveStep === 'done' && (
          <>
            <div className="flex flex-col items-center gap-3 py-4">
              <ShieldCheck className="w-10 h-10 text-green-500" />
              <p className="text-sm text-center text-muted-foreground">
                Your recovery key has been saved to your browser&apos;s password manager.
                It will sync to your cloud account automatically.
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
              Restore your data using the recovery key from your browser&apos;s password
              manager, or enter it manually if you saved it elsewhere.
            </p>

            <Alert variant="danger" aria-live="polite">
              <AlertTriangle className="w-4 h-4" />
              <AlertDescription>
                This will replace your current local identity. Any data not yet synced
                on this device will be lost.
              </AlertDescription>
            </Alert>

            {credManagerAvailable && (
              <Button
                variant="outline"
                onClick={handleRestoreFromBrowser}
                className="w-full"
              >
                <KeyRound className="w-4 h-4 mr-2" />
                Load from Password Manager
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
                autoFocus={!credManagerAvailable}
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
                Your data has been restored successfully. Your identity and encryption
                keys are now set up on this device.
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
