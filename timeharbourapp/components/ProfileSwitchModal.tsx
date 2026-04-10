'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Button, Input, Alert, AlertDescription, Text, SmallMuted } from '@mieweb/ui';
import { UserRoundCog, Loader2, ScanLine, X } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import jsQR from 'jsqr';
import { clearDatabase, db } from '@/TimeharborAPI/db';
import { syncManager } from '@/TimeharborAPI/SyncManager';
import {
  setupEncryption,
  cacheSyncKey,
  clearKeys,
} from '@/TimeharborAPI/sync/KeyManager';
import { verifySyncKey, pullOpLog } from '@/TimeharborAPI/sync/EncryptedSyncEngine';
import { getIdentityUUID } from '@/TimeharborAPI/sync/IdentityManager';
import { resetTicketState } from '@/TimeharborAPI/tickets';

interface ProfileSwitchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Modal for switching to a different user's synced profile.
 * Enter a UUID + encryption key to pull and view their data.
 */
export default function ProfileSwitchModal({ isOpen, onClose }: ProfileSwitchModalProps) {
  const [uuid, setUuid] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [done, setDone] = useState(false);
  const [pulledCount, setPulledCount] = useState(0);
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const currentUuid = typeof window !== 'undefined' ? getIdentityUUID() : '';

  // Parse QR data — supports both deep link URL and raw JSON
  const parseQrData = useCallback((raw: string): { uuid: string; key: string } | null => {
    // Try timeharbor:// deep link
    if (raw.startsWith('timeharbor://')) {
      try {
        const url = new URL(raw);
        const u = url.searchParams.get('uuid');
        const k = url.searchParams.get('key');
        if (u && k) return { uuid: u, key: decodeURIComponent(k) };
      } catch { /* not a valid URL */ }
    }
    // Try JSON fallback
    try {
      const parsed = JSON.parse(raw);
      if (parsed.uuid && parsed.key) return parsed;
    } catch { /* not JSON */ }
    return null;
  }, []);

  const stopScanner = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = undefined;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setScanning(false);
  }, []);

  const startScanner = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: 300, height: 300 },
      });
      streamRef.current = stream;
      setScanning(true);
    } catch {
      setError('Camera access denied. Please allow camera permissions.');
    }
  }, []);

  // Attach stream to video element and start detection AFTER React renders the <video>
  useEffect(() => {
    if (!scanning || !streamRef.current) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const attachStream = () => {
      if (!videoRef.current) {
        requestAnimationFrame(attachStream);
        return;
      }
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});

      scanIntervalRef.current = setInterval(() => {
        if (!videoRef.current || videoRef.current.readyState < 2 || !ctx) return;

        const w = videoRef.current.videoWidth;
        const h = videoRef.current.videoHeight;
        if (!w || !h) return;

        canvas.width = w;
        canvas.height = h;
        ctx.drawImage(videoRef.current, 0, 0, w, h);
        const imageData = ctx.getImageData(0, 0, w, h);

        const code = jsQR(imageData.data, w, h, { inversionAttempts: 'dontInvert' });
        if (code?.data) {
          const result = parseQrData(code.data);
          if (result) {
            stopScanner();
            setUuid(result.uuid);
            setPassphrase(result.key);
          }
        }
      }, 250);
    };

    attachStream();

    return () => {
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = undefined;
      }
    };
  }, [scanning, parseQrData, stopScanner]);

  // Cleanup camera on unmount or modal close
  useEffect(() => {
    return () => stopScanner();
  }, [stopScanner]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!uuid.trim()) {
      setError('Please enter the UUID.');
      return;
    }
    if (!passphrase.trim()) {
      setError('Please enter the encryption key.');
      return;
    }

    // Basic UUID format validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(uuid.trim())) {
      setError('Invalid UUID format.');
      return;
    }

    if (!globalThis.crypto?.subtle) {
      setError('Encryption is not available. WebCrypto requires HTTPS or localhost.');
      return;
    }

    setLoading(true);
    try {
      // 1. Stop current sync
      await syncManager.stop();

      // 2. Clear current database
      await clearDatabase();
      resetTicketState();
      await clearKeys();

      // 3. Set new identity
      localStorage.setItem('th_identity_uuid', uuid.trim());
      localStorage.setItem('th_identity_passphrase', passphrase.trim());

      // 4. Derive encryption keys
      const syncKey = await setupEncryption(passphrase.trim());

      // 5. Verify key against server data
      try {
        await verifySyncKey(syncKey);
      } catch {
        // Revert
        await clearKeys();
        localStorage.removeItem('th_identity_uuid');
        localStorage.removeItem('th_identity_passphrase');
        syncManager.resume();
        throw new Error('OperationError');
      }

      // 6. Cache key and set in sync manager
      await cacheSyncKey(syncKey);
      syncManager.setSyncKey(syncKey);
      syncManager.resume();
      syncManager.requestFullRestore();

      setLoading(false);
      setSyncing(true);

      // 7. Pull all data
      const pulled = await pullOpLog(syncKey, { includeOwn: true });
      setPulledCount(pulled);
      setSyncing(false);
      setDone(true);

    } catch (err: any) {
      setLoading(false);
      setSyncing(false);
      const msg = err?.message ?? '';
      const isWrongKey =
        msg.includes('OperationError') ||
        msg.includes('decrypt') ||
        msg.includes('unwrap');

      setError(
        isWrongKey
          ? 'Incorrect encryption key for this UUID.'
          : msg || 'Profile switch failed.',
      );
    }
  }, [uuid, passphrase]);

  const handleClose = useCallback(() => {    stopScanner();    setUuid('');
    setPassphrase('');
    setError('');
    setLoading(false);
    setSyncing(false);
    setDone(false);
    setPulledCount(0);
    onClose();

    // Reload to pick up new identity if switched
    if (done) {
      window.location.href = '/dashboard';
    }
  }, [onClose, done]);

  return (
    <Modal isOpen={isOpen} onClose={syncing ? () => {} : handleClose} title="Switch Profile">
      <div className="flex flex-col gap-4">
        {/* Current identity info */}
        {!done && !syncing && (
          <div className="rounded-md bg-muted p-3">
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">Current UUID:</span>{' '}
              <code className="text-xs break-all">{currentUuid}</code>
            </p>
          </div>
        )}

        {/* Syncing indicator */}
        {syncing && (
          <div className="flex flex-col items-center gap-3 py-6">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <SmallMuted>Pulling and decrypting data from new profile...</SmallMuted>
          </div>
        )}

        {/* Done state */}
        {done && (
          <>
            <Alert aria-live="polite">
              <AlertDescription>
                Profile switched. Synced {pulledCount} operation{pulledCount !== 1 ? 's' : ''}.
              </AlertDescription>
            </Alert>
            <Button onClick={handleClose} className="w-full">
              Go to Dashboard
            </Button>
          </>
        )}

        {/* Form */}
        {!syncing && !done && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Enter another user&apos;s UUID and encryption key to view their synced data.
              This will replace your current local data.
            </p>

            <Alert variant="danger" aria-live="polite">
              <AlertDescription className="text-xs">
                Switching profiles will clear all local data and replace it with data from the target profile.
              </AlertDescription>
            </Alert>

            {/* QR Scanner */}
            {scanning ? (
              <div className="flex flex-col items-center gap-2">
                <div className="relative rounded-lg overflow-hidden border-2 border-primary" style={{ width: 220, height: 220 }}>
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                    aria-label="Camera viewfinder for QR scanning"
                  />
                  <div className="absolute inset-0 border-2 border-primary/30 rounded-lg pointer-events-none" />
                </div>
                <Button type="button" variant="outline" size="sm" onClick={stopScanner} className="gap-2">
                  <X className="w-4 h-4" />
                  Cancel Scan
                </Button>
              </div>
            ) : (
              <Button type="button" variant="outline" onClick={startScanner} className="gap-2">
                <ScanLine className="w-4 h-4" />
                Scan QR Code
              </Button>
            )}

            <div className="flex flex-col gap-2">
              <label htmlFor="switch-uuid" className="text-sm font-medium">UUID</label>
              <Input
                id="switch-uuid"
                type="text"
                value={uuid}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUuid(e.target.value)}
                placeholder="xxxxxxxx-xxxx-4xxx-xxxx-xxxxxxxxxxxx"
                className="font-mono text-xs"
                autoComplete="off"
                aria-label="Target UUID"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="switch-key" className="text-sm font-medium">Encryption Key</label>
              <Input
                id="switch-key"
                type="password"
                value={passphrase}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassphrase(e.target.value)}
                placeholder="Paste the encryption key"
                autoComplete="off"
                aria-label="Target encryption key"
              />
            </div>

            {error && (
              <Alert variant="danger" aria-live="polite">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Verifying...' : 'Switch Profile'}
            </Button>
            <Button type="button" variant="outline" onClick={handleClose} className="w-full">
              Cancel
            </Button>
          </form>
        )}
      </div>
    </Modal>
  );
}
