'use client';

import { useState, useEffect, useCallback } from 'react';
import { Text, Switch } from '@mieweb/ui';
import { ShieldCheck } from 'lucide-react';
import { Capacitor } from '@capacitor/core';

const APP_LOCK_KEY = 'th_app_lock_enabled';
const APP_LOCK_PIN_KEY = 'th_app_lock_pin_hash';

/**
 * Hash a PIN string using SHA-256 for storage.
 * Never stored in plaintext.
 */
async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(pin);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Check if App Lock is enabled. */
export function isAppLockEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(APP_LOCK_KEY) === '1';
}

/** Get stored PIN hash (null if not set). */
function getStoredPinHash(): string | null {
  return localStorage.getItem(APP_LOCK_PIN_KEY);
}

/**
 * Verify the user via platform biometric or PIN fallback.
 * Returns true if authenticated, false if failed/cancelled.
 */
export async function verifyAppLock(): Promise<boolean> {
  if (!isAppLockEnabled()) return true;

  // Try native biometric first (Capacitor)
  if (Capacitor.isNativePlatform()) {
    try {
      const { NativeBiometric } = await import('@capgo/capacitor-native-biometric');
      const availability = await NativeBiometric.isAvailable();
      if (!availability.isAvailable) return false;
      await NativeBiometric.verifyIdentity({
        reason: 'Unlock TimeHarbor',
        title: 'App Lock',
      });
      return true;
    } catch {
      // Biometric failed/cancelled — fall through to PIN
      return false;
    }
  }

  // Web: try WebAuthn biometric
  try {
    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    if (available) {
      const credId = localStorage.getItem('th_webauthn_cred_id');
      if (credId) {
        await navigator.credentials.get({
          publicKey: {
            challenge: crypto.getRandomValues(new Uint8Array(32)),
            allowCredentials: [{
              id: Uint8Array.from(atob(credId), c => c.charCodeAt(0)),
              type: 'public-key',
            }],
            userVerification: 'required',
            timeout: 60000,
          },
        });
        return true;
      }
    }
  } catch {
    // WebAuthn not available or failed — fall through to PIN
  }

  // Fallback: PIN prompt (handled by the caller showing a PIN modal)
  return false;
}

/**
 * Settings toggle for App Lock — biometric/PIN on app open.
 */
export default function AppLockToggle() {
  const [enabled, setEnabled] = useState(false);
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [hasWebAuthn, setHasWebAuthn] = useState(false);
  const [nativeBioAvailable, setNativeBioAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    setEnabled(isAppLockEnabled());

    if (Capacitor.isNativePlatform()) {
      import('@capgo/capacitor-native-biometric')
        .then(({ NativeBiometric }) => NativeBiometric.isAvailable())
        .then((result) => setNativeBioAvailable(result.isAvailable))
        .catch(() => setNativeBioAvailable(false));
    } else if (typeof PublicKeyCredential !== 'undefined') {
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
        .then(setHasWebAuthn)
        .catch(() => setHasWebAuthn(false));
    }
  }, []);

  const handleToggle = useCallback(async (checked: boolean) => {
    if (checked) {
      if (Capacitor.isNativePlatform()) {
        if (nativeBioAvailable) {
          try {
            const { NativeBiometric } = await import('@capgo/capacitor-native-biometric');
            await NativeBiometric.verifyIdentity({
              reason: 'Enable App Lock',
              title: 'App Lock',
            });
            localStorage.setItem(APP_LOCK_KEY, '1');
            setEnabled(true);
            return;
          } catch {
            // User cancelled biometric — don't fall through to PIN
            return;
          }
        }
        // No biometric on device — use PIN
        setShowPinSetup(true);
      } else if (hasWebAuthn) {
        // Web with biometric: register WebAuthn credential
        try {
          const credential = await navigator.credentials.create({
            publicKey: {
              challenge: crypto.getRandomValues(new Uint8Array(32)),
              rp: { name: 'TimeHarbor' },
              user: {
                id: crypto.getRandomValues(new Uint8Array(16)),
                name: 'timeharbor-user',
                displayName: 'TimeHarbor User',
              },
              pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
              authenticatorSelection: {
                authenticatorAttachment: 'platform',
                userVerification: 'required',
              },
            },
          });
          if (credential) {
            // Store credential ID for future authentication
            const rawId = (credential as PublicKeyCredential).rawId;
            const b64Id = btoa(String.fromCharCode(...new Uint8Array(rawId)));
            localStorage.setItem('th_webauthn_cred_id', b64Id);
            localStorage.setItem(APP_LOCK_KEY, '1');
            setEnabled(true);
          }
        } catch {
          // WebAuthn registration failed — offer PIN fallback
          setShowPinSetup(true);
        }
      } else {
        // No biometric — use PIN
        setShowPinSetup(true);
      }
    } else {
      // Disable app lock
      localStorage.removeItem(APP_LOCK_KEY);
      localStorage.removeItem(APP_LOCK_PIN_KEY);
      localStorage.removeItem('th_webauthn_cred_id');
      setEnabled(false);
    }
  }, [hasWebAuthn, nativeBioAvailable]);

  const handlePinSubmit = useCallback(async () => {
    setPinError('');
    if (pin.length < 4 || pin.length > 6) {
      setPinError('PIN must be 4-6 digits.');
      return;
    }
    if (!/^\d+$/.test(pin)) {
      setPinError('PIN must be digits only.');
      return;
    }
    if (pin !== confirmPin) {
      setPinError('PINs do not match.');
      return;
    }

    const hashed = await hashPin(pin);
    localStorage.setItem(APP_LOCK_PIN_KEY, hashed);
    localStorage.setItem(APP_LOCK_KEY, '1');
    setEnabled(true);
    setShowPinSetup(false);
    setPin('');
    setConfirmPin('');
  }, [pin, confirmPin]);

  return (
    <>
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-4">
          <ShieldCheck className="w-5 h-5 text-muted-foreground" />
          <div>
            <Text className="font-medium">App Lock</Text>
            <p className="text-xs text-muted-foreground">
              {Capacitor.isNativePlatform()
                ? nativeBioAvailable
                  ? 'Face ID / Touch ID on app open'
                  : 'PIN lock on app open'
                : hasWebAuthn
                  ? 'Biometric / PIN on app open'
                  : 'PIN lock on app open'}
            </p>
          </div>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={handleToggle}
          aria-label="Toggle app lock"
        />
      </div>

      {/* PIN Setup Inline Form */}
      {showPinSetup && (
        <div className="px-6 py-4 bg-muted/50 space-y-3">
          <p className="text-sm font-medium">Set a PIN to lock the app</p>
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="Enter 4-6 digit PIN"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            autoFocus
            aria-label="Set PIN"
          />
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={confirmPin}
            onChange={(e) => setConfirmPin(e.target.value)}
            placeholder="Confirm PIN"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            aria-label="Confirm PIN"
          />
          {pinError && <p className="text-xs text-destructive">{pinError}</p>}
          <div className="flex gap-2">
            <button
              onClick={handlePinSubmit}
              className="flex-1 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90"
            >
              Set PIN
            </button>
            <button
              onClick={() => { setShowPinSetup(false); setPin(''); setConfirmPin(''); setPinError(''); }}
              className="flex-1 rounded-md border border-input px-3 py-2 text-sm hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
