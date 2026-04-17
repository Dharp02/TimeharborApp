'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Input, Button, Alert, AlertDescription, Text, SmallMuted } from '@mieweb/ui';
import { KeyRound, Download, Loader2 } from 'lucide-react';
import { db } from '@/TimeharborAPI/db';
import { clearDatabase } from '@/TimeharborAPI/db';
import { switchProfileDatabase } from '@/TimeharborAPI/db';
import { syncManager } from '@/TimeharborAPI/SyncManager';
import {
  setupEncryption,
  cacheSyncKey,
  clearKeys,
} from '@/TimeharborAPI/sync/KeyManager';
import { verifySyncKey, pullOpLog } from '@/TimeharborAPI/sync/EncryptedSyncEngine';

/**
 * /share?uuid=XXXXXX — landing page for receiving shared sync data.
 *
 * 1. Reads the UUID from the query param
 * 2. Prompts for the encryption key (passphrase)
 * 3. Stores the UUID as identity, derives sync key, pulls + decrypts data
 * 4. Redirects to /dashboard
 */
export default function SharePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    }>
      <SharePageContent />
    </Suspense>
  );
}

function SharePageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const uuid = searchParams.get('uuid') || '';
  const keyFromUrl = searchParams.get('key') || '';

  const [passphrase, setPassphrase] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncComplete, setSyncComplete] = useState(false);
  const [pulledCount, setPulledCount] = useState(0);

  useEffect(() => {
    if (!uuid) {
      setError('No UUID provided in the URL. Please use a valid share link.');
    }
    // Auto-fill key if provided via deep link
    if (keyFromUrl) {
      setPassphrase(decodeURIComponent(keyFromUrl));
    }
  }, [uuid, keyFromUrl]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!uuid) {
      setError('No UUID in the URL.');
      return;
    }
    if (!passphrase) {
      setError('Please enter the encryption key.');
      return;
    }

    if (!globalThis.crypto?.subtle) {
      setError(
        'Encryption is not available. WebCrypto requires HTTPS or localhost.',
      );
      return;
    }

    setLoading(true);
    try {
      // Store the sender's UUID as our identity for this session
      localStorage.setItem('th_identity_uuid', uuid);
      localStorage.setItem('th_identity_passphrase', passphrase);
      await switchProfileDatabase(uuid);

      // Derive encryption keys from the passphrase
      const syncKey = await setupEncryption(passphrase);

      // Verify we can decrypt the data before committing
      try {
        await verifySyncKey(syncKey);
      } catch (err: any) {
        await clearKeys();
        localStorage.removeItem('th_identity_uuid');
        localStorage.removeItem('th_identity_passphrase');
        throw new Error('OperationError');
      }

      // Key is valid — cache it
      await cacheSyncKey(syncKey);

      // Clear existing local data so we get a clean pull from the sender
      await clearDatabase();

      // Re-cache keys after DB clear (clearDatabase wipes Dexie)
      await setupEncryption(passphrase);
      await cacheSyncKey(syncKey);
      syncManager.setSyncKey(syncKey);

      setSyncing(true);
      setLoading(false);

      // Pull all data (including our own since we're restoring)
      const pulled = await pullOpLog(syncKey, { includeOwn: true });

      // Clear sender's profile so the recipient starts fresh.
      // Session sharing syncs work data, not personal profile info.
      await db.userProfiles.clear();

      setPulledCount(pulled);
      setSyncing(false);
      setSyncComplete(true);
    } catch (err: any) {
      setLoading(false);
      setSyncing(false);
      const msg = err?.message ?? '';
      const isWrongKey =
        msg.includes('OperationError') ||
        msg.includes('decrypt') ||
        msg.includes('unwrap') ||
        err?.name === 'OperationError';

      setError(
        isWrongKey
          ? 'Incorrect encryption key. Please check and try again.'
          : msg || 'An error occurred.',
      );
    }
  }, [uuid, passphrase]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <KeyRound className="w-8 h-8 text-primary" />
          </div>
          <Text className="text-2xl font-bold">TimeHarbor Sync</Text>
          <SmallMuted>
            {syncComplete
              ? 'Data synced successfully!'
              : syncing
              ? 'Syncing encrypted data...'
              : 'Enter the encryption key to access shared data.'}
          </SmallMuted>
        </div>

        {/* UUID display */}
        {uuid && !syncComplete && (
          <div className="rounded-md bg-muted p-3">
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">Connecting to UUID:</span>{' '}
              <code className="text-xs break-all">{uuid}</code>
            </p>
          </div>
        )}

        {/* Syncing state */}
        {syncing && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <SmallMuted>Pulling and decrypting data...</SmallMuted>
          </div>
        )}

        {/* Success state */}
        {syncComplete && (
          <div className="space-y-4">
            <Alert aria-live="polite">
              <AlertDescription>
                Successfully synced {pulledCount} operation{pulledCount !== 1 ? 's' : ''}.
                Your data is now available locally.
              </AlertDescription>
            </Alert>
            <Button className="w-full" onClick={() => router.replace('/dashboard')}>
              Go to Dashboard
            </Button>
          </div>
        )}

        {/* Key entry form */}
        {!syncing && !syncComplete && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="share-key" className="text-sm font-medium">
                Encryption Key
              </label>
              <Input
                id="share-key"
                type="password"
                value={passphrase}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassphrase(e.target.value)}
                placeholder="Paste the encryption key"
                autoFocus
                autoComplete="off"
                aria-label="Encryption key"
              />
            </div>

            {error && (
              <Alert variant="danger" aria-live="polite">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" disabled={loading || !uuid} className="w-full">
              {loading ? 'Verifying key...' : 'Sync Data'}
            </Button>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => router.replace('/dashboard')}
            >
              Skip — Go to Dashboard
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
