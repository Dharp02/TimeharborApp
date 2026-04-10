'use client';

import React, { useState, useCallback } from 'react';
import { Button, Alert, AlertDescription, Input } from '@mieweb/ui';
import { Copy, Check, Download, AlertTriangle } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { regenerateIdentity, getIdentityUUID } from '@/TimeharborAPI/sync/IdentityManager';
import { syncManager } from '@/TimeharborAPI/SyncManager';
import { purgeAllServerData, resetOpLogCursor, pushOpLog } from '@/TimeharborAPI/sync/EncryptedSyncEngine';
import { resetRecoveryKeySaved } from '@/TimeharborAPI/sync/RecoveryKeyService';
import { db } from '@/TimeharborAPI/db';

interface KeyRegenerationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Modal for regenerating the encryption key.
 * Warns user that old shared links will break, then re-encrypts and re-pushes data.
 */
export default function KeyRegenerationModal({ isOpen, onClose }: KeyRegenerationModalProps) {
  const [step, setStep] = useState<'confirm' | 'regenerating' | 'done'>('confirm');
  const [newPassphrase, setNewPassphrase] = useState('');
  const [copiedKey, setCopiedKey] = useState(false);
  const [savedConfirmed, setSavedConfirmed] = useState(false);
  const [error, setError] = useState('');

  const handleRegenerate = useCallback(async () => {
    setError('');
    setStep('regenerating');
    try {
      // 1. Purge ALL old encrypted data from the server (old key becomes useless)
      await purgeAllServerData();

      // 1b. Reset recovery-key-saved flag (new key = new recovery key needed)
      await resetRecoveryKeySaved().catch(() => {});

      // 2. Regenerate passphrase + encryption keys
      const { passphrase, syncKey } = await regenerateIdentity();
      setNewPassphrase(passphrase);

      // 3. Set the new key in SyncManager
      syncManager.setSyncKey(syncKey);

      // 4. Reset the pull cursor so it starts fresh
      await resetOpLogCursor();

      // 5. Mark all existing op-log entries as unsynced so they get re-pushed
      await db.opLog.toCollection().modify({ _synced: 0 });

      // 6. Push directly (bypasses syncManager.syncNow which silently
      //    skips if another sync is in progress)
      await pushOpLog(syncKey);

      setStep('done');
    } catch (err: any) {
      setError(err?.message || 'Key regeneration failed.');
      setStep('confirm');
    }
  }, []);

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    } catch { /* Clipboard API not available */ }
  }, []);

  const exportKeyFile = useCallback(() => {
    const uuid = getIdentityUUID();
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const content = [
      'TimeHarbor Sync Key (Regenerated)',
      '==================================',
      '',
      `UUID: ${uuid}`,
      `Share URL: ${origin}/share?uuid=${uuid}`,
      `New Encryption Key: ${newPassphrase}`,
      '',
      'The previous key is no longer valid.',
      `Regenerated: ${new Date().toISOString()}`,
    ].join('\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'timeharbor-sync-key-new.txt';
    a.click();
    URL.revokeObjectURL(url);
  }, [newPassphrase]);

  const handleClose = useCallback(() => {
    setStep('confirm');
    setNewPassphrase('');
    setCopiedKey(false);
    setSavedConfirmed(false);
    setError('');
    onClose();
  }, [onClose]);

  return (
    <Modal isOpen={isOpen} onClose={step === 'regenerating' ? () => {} : handleClose} title="Regenerate Encryption Key">
      <div className="flex flex-col gap-4">
        {/* Step 1: Confirm */}
        {step === 'confirm' && (
          <>
            <Alert variant="danger" aria-live="polite">
              <AlertTriangle className="w-4 h-4" />
              <AlertDescription>
                <strong>Warning:</strong> Regenerating your key will make all existing shared links
                stop working. Recipients will need your new key to access your data.
                Your local data will be re-encrypted and re-pushed to the server.
              </AlertDescription>
            </Alert>

            {error && (
              <Alert variant="danger" aria-live="polite">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button variant="danger" onClick={handleRegenerate} className="w-full">
              Regenerate Key
            </Button>
            <Button variant="outline" onClick={handleClose} className="w-full">
              Cancel
            </Button>
          </>
        )}

        {/* Step 2: Regenerating */}
        {step === 'regenerating' && (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">Regenerating key and re-syncing data...</p>
          </div>
        )}

        {/* Step 3: Done — show new key */}
        {step === 'done' && (
          <>
            <p className="text-sm text-muted-foreground">
              Your key has been regenerated. Save the new key below.
            </p>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium" id="new-key-label">New Encryption Key</label>
              <div className="flex gap-2">
                <Input
                  value={newPassphrase}
                  readOnly
                  className="font-mono text-xs"
                  aria-labelledby="new-key-label"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(newPassphrase)}
                  aria-label="Copy new encryption key"
                >
                  {copiedKey ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            <Button variant="outline" onClick={exportKeyFile} className="w-full">
              <Download className="w-4 h-4 mr-2" />
              Export to File
            </Button>

            <Alert aria-live="polite">
              <AlertDescription>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={savedConfirmed}
                    onChange={(e) => setSavedConfirmed(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300"
                    aria-label="I have saved my new key"
                  />
                  <span className="text-sm">
                    I have saved my new encryption key.
                  </span>
                </label>
              </AlertDescription>
            </Alert>

            <Button onClick={handleClose} disabled={!savedConfirmed} className="w-full">
              Done
            </Button>
          </>
        )}
      </div>
    </Modal>
  );
}
