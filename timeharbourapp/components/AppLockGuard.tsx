'use client';

import { useState, useEffect, useCallback } from 'react';
import { KeyRound } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { isAppLockEnabled, verifyAppLock } from './AppLockToggle';
import { Text } from '@mieweb/ui';

const APP_LOCK_PIN_KEY = 'th_app_lock_pin_hash';

async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(pin);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Full-screen lock overlay shown when App Lock is enabled.
 * Wraps the entire app — children are hidden until unlocked.
 */
export default function AppLockGuard({ children }: { children: React.ReactNode }) {
  const [locked, setLocked] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [checking, setChecking] = useState(true);

  const attemptUnlock = useCallback(async () => {
    if (!isAppLockEnabled()) {
      setLocked(false);
      setChecking(false);
      return;
    }

    setChecking(true);
    const passed = await verifyAppLock();
    if (passed) {
      setLocked(false);
    } else {
      // Biometric failed — show PIN fallback if configured
      const storedHash = localStorage.getItem(APP_LOCK_PIN_KEY);
      if (storedHash) {
        setLocked(true);
      } else {
        // No PIN configured and biometric failed — can't lock out completely
        setLocked(false);
      }
    }
    setChecking(false);
  }, []);

  // Check on mount
  useEffect(() => {
    attemptUnlock();
  }, [attemptUnlock]);

  // Check when app resumes from background (Capacitor)
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let handle: any;
    import('@capacitor/app').then(({ App }) => {
      App.addListener('appStateChange', ({ isActive }) => {
        if (isActive && isAppLockEnabled()) {
          setLocked(true);
          attemptUnlock();
        }
      }).then((h) => { handle = h; });
    });
    return () => { handle?.remove(); };
  }, [attemptUnlock]);

  // Web: check on tab visibility change
  useEffect(() => {
    if (Capacitor.isNativePlatform()) return;
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && isAppLockEnabled()) {
        attemptUnlock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [attemptUnlock]);

  const handlePinSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError('');
    const storedHash = localStorage.getItem(APP_LOCK_PIN_KEY);
    if (!storedHash) { setLocked(false); return; }

    const inputHash = await hashPin(pin);
    if (inputHash === storedHash) {
      setLocked(false);
      setPin('');
    } else {
      setPinError('Incorrect PIN.');
      setPin('');
    }
  }, [pin]);

  // Don't show lock screen while still checking
  if (checking && !locked) {
    return <>{children}</>;
  }

  if (!locked) {
    return <>{children}</>;
  }

  // Lock screen overlay
  return (
    <>
      <div className="fixed inset-0 z-100g-background flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-xs space-y-6 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <KeyRound className="w-8 h-8 text-primary" />
          </div>
          <Text className="text-xl font-bold">TimeHarbor Locked</Text>
          <p className="text-sm text-muted-foreground">Enter your PIN to unlock</p>

          <form onSubmit={handlePinSubmit} className="space-y-3">
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Enter PIN"
              className="w-full text-center text-2xl tracking-[0.5em] rounded-md border border-input bg-background px-3 py-3"
              autoFocus
              aria-label="Unlock PIN"
            />
            {pinError && <p className="text-xs text-destructive">{pinError}</p>}

            <button
              type="submit"
              className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Unlock
            </button>
          </form>

          {/* Retry biometric button */}
          <button
            onClick={attemptUnlock}
            className="text-sm text-primary hover:underline"
          >
            Try biometric again
          </button>
        </div>
      </div>
      {/* Keep children mounted but hidden so state isn't lost */}
      <div className="hidden" aria-hidden="true">{children}</div>
    </>
  );
}
