'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useRefresh } from '@/contexts/RefreshContext';
import { Button, Input, Alert, AlertDescription, Text, SmallMuted } from '@mieweb/ui';
import { Loader2, ScanLine, X, Plus, Download, UserRound, Trash2, Check, Pencil } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import jsQR from 'jsqr';
import { hasProfileDatabase, switchProfileDatabase } from '@/TimeharborAPI/db';
import { syncManager } from '@/TimeharborAPI/SyncManager';
import {
  setupEncryption,
  cacheSyncKey,
  clearKeys,
} from '@/TimeharborAPI/sync/KeyManager';
import { verifySyncKey, pullOpLog } from '@/TimeharborAPI/sync/EncryptedSyncEngine';
import { getIdentityUUID } from '@/TimeharborAPI/sync/IdentityManager';
import { resetTicketState } from '@/TimeharborAPI/tickets';
import {
  type SavedProfile,
  getSavedProfiles,
  saveProfile,
  removeProfile,
  renameProfile,
  canAddProfile,
  ensureCurrentProfileSaved,
  touchActiveProfile,
} from '@/TimeharborAPI/sync/ProfileRegistry';
import { v4 as uuidv4 } from 'uuid';
import { toBase64 } from '@/TimeharborAPI/sync/encoding';

interface ProfileSwitchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type View = 'list' | 'new' | 'import';
type SwitchOptions = {
  allowEmptyOffline?: boolean;
};

/**
 * Modal for managing multiple profiles — switch between saved profiles,
 * create new ones, or import a profile by UUID + encryption key.
 */
export default function ProfileSwitchModal({ isOpen, onClose }: ProfileSwitchModalProps) {
  const [view, setView] = useState<View>('list');
  const router = useRouter();
  const { refreshAll } = useRefresh();

  // Shared switch state
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [done, setDone] = useState(false);
  const [pulledCount, setPulledCount] = useState(0);
  const [switchedOffline, setSwitchedOffline] = useState(false);

  // Import form fields
  const [uuid, setUuid] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [importName, setImportName] = useState('');

  // New profile fields
  const [newProfileName, setNewProfileName] = useState('');

  // QR scanner
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  // Profile list (refreshed on open / after actions)
  const [profiles, setProfiles] = useState<SavedProfile[]>([]);
  const [editingUuid, setEditingUuid] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const currentUuid = typeof window !== 'undefined' ? getIdentityUUID() : '';

  // Refresh profile list whenever modal opens
  useEffect(() => {
    if (isOpen) {
      ensureCurrentProfileSaved();
      setProfiles(getSavedProfiles());
    }
  }, [isOpen]);

  const refreshProfiles = useCallback(() => {
    setProfiles(getSavedProfiles());
  }, []);

  // ── QR Scanner ──────────────────────────────────────────

  const parseQrData = useCallback((raw: string): { uuid: string; key: string } | null => {
    if (raw.startsWith('timeharbor://')) {
      try {
        const url = new URL(raw);
        const u = url.searchParams.get('uuid');
        const k = url.searchParams.get('key');
        if (u && k) return { uuid: u, key: decodeURIComponent(k) };
      } catch { /* not a valid URL */ }
    }
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
      streamRef.current.getTracks().forEach((t) => t.stop());
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

  useEffect(() => {
    return () => stopScanner();
  }, [stopScanner]);

  // ── Core switch logic (shared by all flows) ─────────────

  const switchToProfile = useCallback(
    async (
      targetUuid: string,
      targetPassphrase: string,
      profileName: string,
      options: SwitchOptions = {},
    ) => {
      setError('');
      setLoading(true);

      const previousUuid = typeof window !== 'undefined' ? getIdentityUUID() : '';
      const previousPassphrase =
        typeof window !== 'undefined' ? localStorage.getItem('th_identity_passphrase') ?? '' : '';

      try {
        if (!globalThis.crypto?.subtle) {
          throw new Error('Encryption is not available. WebCrypto requires HTTPS or localhost.');
        }

        const isOnline = navigator.onLine;
        setSwitchedOffline(!isOnline);
        const targetHasLocalData = getSavedProfiles().some(p => p.uuid === targetUuid) || await hasProfileDatabase(targetUuid);

        if (!isOnline && !targetHasLocalData && !options.allowEmptyOffline) {
          throw new Error('This profile has no local data yet. Connect to the internet to load it once.');
        }

        // 1. Save current profile before switching
        touchActiveProfile();

        // 2. Stop current sync
        await syncManager.stop();

        // 3. Swap active DB to target profile
        await clearKeys();
        await switchProfileDatabase(targetUuid);
        resetTicketState();

        // 4. Set new identity
        localStorage.setItem('th_identity_uuid', targetUuid);
        localStorage.setItem('th_identity_passphrase', targetPassphrase);

        // 5. Derive encryption keys
        const syncKey = await setupEncryption(targetPassphrase);

        // 6. Verify key against server when online
        if (isOnline) {
          try {
            await verifySyncKey(syncKey);
          } catch {
            // Revert to previous profile context
            await clearKeys();
            if (previousUuid) {
              await switchProfileDatabase(previousUuid);
              resetTicketState();
              localStorage.setItem('th_identity_uuid', previousUuid);
              if (previousPassphrase) {
                localStorage.setItem('th_identity_passphrase', previousPassphrase);
                const previousSyncKey = await setupEncryption(previousPassphrase);
                await cacheSyncKey(previousSyncKey);
                syncManager.setSyncKey(previousSyncKey);
              }
            } else {
              localStorage.removeItem('th_identity_uuid');
              localStorage.removeItem('th_identity_passphrase');
            }
            syncManager.resume();
            throw new Error('OperationError');
          }
        }

        // 7. Cache key and restart sync
        await cacheSyncKey(syncKey);
        syncManager.setSyncKey(syncKey);
        syncManager.resume();
        if (isOnline) {
          syncManager.requestFullRestore();
        }

        // 8. Save/update profile in registry
        saveProfile({ uuid: targetUuid, passphrase: targetPassphrase, name: profileName });

        setLoading(false);
        if (isOnline) {
          setSyncing(true);

          // 9. Pull all data
          const pulled = await pullOpLog(syncKey, { includeOwn: true });
          setPulledCount(pulled);
          setSyncing(false);
        } else {
          setPulledCount(0);
        }
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
    },
    [],
  );

  // ── New profile ─────────────────────────────────────────

  const handleCreateProfile = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');

      const name = newProfileName.trim();
      if (!name) {
        setError('Please enter a profile name.');
        return;
      }

      if (!canAddProfile()) {
        setError('Maximum of 5 profiles reached. Remove one first.');
        return;
      }

      // Generate fresh credentials
      const newUuid = uuidv4();
      const bytes = crypto.getRandomValues(new Uint8Array(32));
      const newPassphrase = toBase64(bytes);

      await switchToProfile(newUuid, newPassphrase, name, { allowEmptyOffline: true });
    },
    [newProfileName, switchToProfile],
  );

  // ── Import profile ──────────────────────────────────────

  const handleImportProfile = useCallback(
    async (e: React.FormEvent) => {
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

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(uuid.trim())) {
        setError('Invalid UUID format.');
        return;
      }

      if (!canAddProfile()) {
        setError('Maximum of 5 profiles reached. Remove one first.');
        return;
      }

      const name = importName.trim() || 'Imported Profile';
      await switchToProfile(uuid.trim(), passphrase.trim(), name);
    },
    [uuid, passphrase, importName, switchToProfile],
  );

  // ── Saved profile quick-switch ──────────────────────────

  const handleSwitchToSaved = useCallback(
    async (profile: SavedProfile) => {
      if (profile.uuid === currentUuid) return;
      await switchToProfile(profile.uuid, profile.passphrase, profile.name);
    },
    [currentUuid, switchToProfile],
  );

  // ── Profile management ──────────────────────────────────

  const handleRemoveProfile = useCallback(
    (profileUuid: string) => {
      const removed = removeProfile(profileUuid);
      if (removed) {
        // Also delete the physical database to avoid orphans
        try {
          const dbName = `TimeharborDB_${profileUuid.trim()}`;
          indexedDB.deleteDatabase(dbName);
        } catch (e) {
          console.warn('Failed to delete profile database', e);
        }
      }
      refreshProfiles();
    },
    [refreshProfiles],
  );

  const handleStartRename = useCallback((profile: SavedProfile) => {
    setEditingUuid(profile.uuid);
    setEditName(profile.name);
  }, []);

  const handleSaveRename = useCallback(() => {
    if (editingUuid && editName.trim()) {
      renameProfile(editingUuid, editName.trim());
      setEditingUuid(null);
      setEditName('');
      refreshProfiles();
    }
  }, [editingUuid, editName, refreshProfiles]);

  // ── Modal reset ─────────────────────────────────────────

  const resetState = useCallback(() => {
    stopScanner();
    setView('list');
    setUuid('');
    setPassphrase('');
    setImportName('');
    setNewProfileName('');
    setError('');
    setLoading(false);
    setSyncing(false);
    setDone(false);
    setPulledCount(0);
    setSwitchedOffline(false);
    setEditingUuid(null);
    setEditName('');
  }, [stopScanner]);

  const handleClose = useCallback(() => {
    const wasDone = done;
    resetState();
    onClose();
    if (wasDone) {
      refreshAll();
      router.push('/dashboard');
      router.refresh();
    }
  }, [onClose, done, resetState, refreshAll, router]);

  // ── Render helpers ──────────────────────────────────────

  const modalTitle =
    view === 'new' ? 'New Profile' : view === 'import' ? 'Import Profile' : 'Profiles';

  return (
    <Modal isOpen={isOpen} onClose={syncing ? () => {} : handleClose} title={modalTitle}>
      <div className="flex flex-col gap-4">
        {/* Syncing indicator */}
        {syncing && (
          <div className="flex flex-col items-center gap-3 py-6">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <SmallMuted>Pulling and decrypting profile data...</SmallMuted>
          </div>
        )}

        {/* Done state */}
        {done && (
          <>
            <Alert aria-live="polite">
              <AlertDescription>
                {switchedOffline
                  ? 'Profile switched using local data. It will sync when you are back online.'
                  : `Profile switched. Synced ${pulledCount} operation${pulledCount !== 1 ? 's' : ''}.`}
              </AlertDescription>
            </Alert>
            <Button onClick={handleClose} className="w-full">
              Go to Dashboard
            </Button>
          </>
        )}

        {/* ── Profile List View ──────────────────────────── */}
        {!syncing && !done && view === 'list' && (
          <div className="flex flex-col gap-3">
            {profiles.length === 0 ? (
              <SmallMuted>No saved profiles yet.</SmallMuted>
            ) : (
              <div className="flex flex-col gap-1" role="list" aria-label="Saved profiles">
                {profiles.map((profile) => {
                  const isActive = profile.uuid === currentUuid;
                  const isEditing = editingUuid === profile.uuid;

                  return (
                    <div
                      key={profile.uuid}
                      role="listitem"
                      className={`flex items-center gap-3 rounded-lg px-3 py-3 transition-colors ${
                        isActive ? 'bg-primary/10 border border-primary/30' : 'hover:bg-muted'
                      }`}
                    >
                      <UserRound className="w-5 h-5 shrink-0 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <Input
                              value={editName}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                setEditName(e.target.value)
                              }
                              className="h-7 text-sm"
                              autoFocus
                              maxLength={30}
                              onKeyDown={(e: React.KeyboardEvent) => {
                                if (e.key === 'Enter') handleSaveRename();
                                if (e.key === 'Escape') setEditingUuid(null);
                              }}
                              aria-label="Profile name"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={handleSaveRename}
                              aria-label="Save name"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-2">
                              <Text className="text-sm font-medium truncate">{profile.name}</Text>
                              {isActive && (
                                <span className="text-[10px] font-semibold uppercase tracking-wide text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                                  Active
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground font-mono truncate">
                              {profile.uuid}
                            </p>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {!isEditing && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleStartRename(profile)}
                            aria-label={`Rename ${profile.name}`}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        {!isActive && !isEditing && (
                          <>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleSwitchToSaved(profile)}
                              disabled={loading}
                              aria-label={`Switch to ${profile.name}`}
                            >
                              Switch
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveProfile(profile.uuid)}
                              aria-label={`Remove ${profile.name}`}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {error && (
              <Alert variant="danger" aria-live="polite">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Action buttons */}
            <div className="flex flex-col gap-2 pt-2 border-t border-border">
              <Button
                type="button"
                onClick={() => { setError(''); setView('new'); }}
                className="w-full gap-2"
                disabled={!canAddProfile()}
                aria-label="New Profile"
              >
                <Plus className="w-4 h-4" />
                New Profile
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => { setError(''); setView('import'); }}
                className="w-full gap-2"
                disabled={!canAddProfile()}
                aria-label="Import Profile"
              >
                <Download className="w-4 h-4" />
                Import Profile
              </Button>
              {!canAddProfile() && (
                <SmallMuted className="text-center">
                  Maximum of 5 profiles reached. Remove one to add more.
                </SmallMuted>
              )}
            </div>
          </div>
        )}

        {/* ── New Profile View ───────────────────────────── */}
        {!syncing && !done && view === 'new' && (
          <form onSubmit={handleCreateProfile} className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Create a fresh profile with its own data and encryption key.
            </p>

            <div className="flex flex-col gap-2">
              <label htmlFor="new-profile-name" className="text-sm font-medium">
                Profile Name
              </label>
              <Input
                id="new-profile-name"
                type="text"
                value={newProfileName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setNewProfileName(e.target.value)
                }
                placeholder="e.g. Work, Personal, Client"
                maxLength={30}
                autoFocus
                autoComplete="off"
                aria-label="New profile name"
              />
            </div>

            <Alert variant="danger" aria-live="polite">
              <AlertDescription className="text-xs">
                Creating a new profile will clear local data and start fresh.
                You can switch back to your current profile anytime.
              </AlertDescription>
            </Alert>

            {error && (
              <Alert variant="danger" aria-live="polite">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Creating...' : 'Create Profile'}
            </Button>
            <Button type="button" variant="outline" onClick={() => { setError(''); setView('list'); }} className="w-full">
              Back
            </Button>
          </form>
        )}

        {/* ── Import Profile View ────────────────────────── */}
        {!syncing && !done && view === 'import' && (
          <form onSubmit={handleImportProfile} className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Enter another user&apos;s UUID and encryption key to import their synced data as a profile.
            </p>

            <Alert variant="danger" aria-live="polite">
              <AlertDescription className="text-xs">
                Switching profiles will clear local data and replace it with data from the target profile.
              </AlertDescription>
            </Alert>

            {/* QR Scanner */}
            {scanning ? (
              <div className="flex flex-col items-center gap-2">
                <div
                  className="relative rounded-lg overflow-hidden border-2 border-primary"
                  style={{ width: 220, height: 220 }}
                >
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
              <label htmlFor="import-name" className="text-sm font-medium">
                Profile Name
              </label>
              <Input
                id="import-name"
                type="text"
                value={importName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setImportName(e.target.value)}
                placeholder="e.g. Shared, Team"
                maxLength={30}
                autoComplete="off"
                aria-label="Imported profile name"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="switch-uuid" className="text-sm font-medium">
                UUID
              </label>
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
              <label htmlFor="switch-key" className="text-sm font-medium">
                Encryption Key
              </label>
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
              {loading ? 'Verifying...' : 'Import & Switch'}
            </Button>
            <Button type="button" variant="outline" onClick={() => { setError(''); setView('list'); }} className="w-full">
              Back
            </Button>
          </form>
        )}
      </div>
    </Modal>
  );
}
