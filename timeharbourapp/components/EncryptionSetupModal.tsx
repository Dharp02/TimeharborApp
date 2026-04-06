'use client';

import React, { useState, useCallback } from 'react';
import { Input, Button, Alert, AlertDescription } from '@mieweb/ui';
import { Modal } from '@/components/ui/Modal';

interface EncryptionSetupModalProps {
  /** Whether to show the modal. */
  isOpen: boolean;
  /** 'setup' for first-time, 'unlock' for returning device. */
  mode: 'setup' | 'unlock';
  /** Called with the passphrase after successful validation. */
  onSubmit: (passphrase: string) => Promise<void>;
}

/**
 * Modal that prompts the user for their encryption passphrase.
 *
 * - **Setup mode**: first-time encryption setup — requires confirmation.
 * - **Unlock mode**: returning user — single passphrase field.
 *
 * Cannot be dismissed — encryption must be configured before sync works.
 */
export default function EncryptionSetupModal({
  isOpen,
  mode,
  onSubmit,
}: EncryptionSetupModalProps) {
  const [passphrase, setPassphrase] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');

      if (mode === 'setup') {
        if (passphrase.length < 8) {
          setError('Passphrase must be at least 8 characters.');
          return;
        }
        if (passphrase !== confirm) {
          setError('Passphrases do not match.');
          return;
        }
      }

      if (!passphrase) {
        setError('Passphrase is required.');
        return;
      }

      // WebCrypto requires a secure context (HTTPS or localhost)
      if (!globalThis.crypto?.subtle) {
        setError(
          'Encryption is not available in this context. ' +
          'WebCrypto requires HTTPS or localhost. ' +
          'Please use a production build to test encryption on this device.',
        );
        return;
      }

      setLoading(true);
      try {
        await onSubmit(passphrase);
      } catch (err: any) {
        const msg = err?.message ?? '';
        const isWrongPassphrase =
          msg.includes('unwrap') ||
          msg.includes('OperationError') ||
          msg.includes('decrypt') ||
          err?.name === 'OperationError' ||
          err?.name === 'InvalidAccessError';

        setError(
          isWrongPassphrase
            ? 'Incorrect passphrase. Please try again.'
            : msg || 'An error occurred.',
        );
      } finally {
        setLoading(false);
      }
    },
    [passphrase, confirm, mode, onSubmit],
  );

  const title =
    mode === 'setup'
      ? 'Set Up End-to-End Encryption'
      : 'Unlock Encryption';

  // Prevent closing — encryption is required
  const noop = () => {};

  return (
    <Modal isOpen={isOpen} onClose={noop} title={title}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          {mode === 'setup'
            ? 'Choose a passphrase to protect your data. This passphrase encrypts your data end-to-end — the server never sees it. You will need this passphrase to set up new devices.'
            : 'Enter your encryption passphrase to unlock your data on this device.'}
        </p>

        <div className="flex flex-col gap-2">
          <label
            htmlFor="encryption-passphrase"
            className="text-sm font-medium"
          >
            Passphrase
          </label>
          <Input
            id="encryption-passphrase"
            type="password"
            value={passphrase}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setPassphrase(e.target.value)
            }
            placeholder="Enter your passphrase"
            autoFocus
            aria-label="Encryption passphrase"
            autoComplete={mode === 'setup' ? 'new-password' : 'current-password'}
          />
        </div>

        {mode === 'setup' && (
          <div className="flex flex-col gap-2">
            <label
              htmlFor="encryption-confirm"
              className="text-sm font-medium"
            >
              Confirm Passphrase
            </label>
            <Input
              id="encryption-confirm"
              type="password"
              value={confirm}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setConfirm(e.target.value)
              }
              placeholder="Re-enter your passphrase"
              aria-label="Confirm encryption passphrase"
              autoComplete="new-password"
            />
          </div>
        )}

        {error && (
          <Alert variant="danger" aria-live="polite">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Button type="submit" disabled={loading} className="w-full">
          {loading
            ? 'Please wait…'
            : mode === 'setup'
            ? 'Enable Encryption'
            : 'Unlock'}
        </Button>
      </form>
    </Modal>
  );
}
