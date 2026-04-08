'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Button, Alert, AlertDescription, Input } from '@mieweb/ui';
import { Copy, Check, Download, QrCode, Share2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { getIdentityUUID, getIdentityPassphrase } from '@/TimeharborAPI/sync/IdentityManager';
import QRCode from 'qrcode';

interface ShareMyLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const FIRST_SHARE_KEY = 'th_first_share_done';

/**
 * Modal that reveals the user's UUID + encryption key for sharing.
 * On first share, requires the user to confirm they've saved their key.
 */
export default function ShareMyLinkModal({ isOpen, onClose }: ShareMyLinkModalProps) {
  const [uuid, setUuid] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [shareUrl, setShareUrl] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [savedConfirmed, setSavedConfirmed] = useState(false);
  const [isFirstShare, setIsFirstShare] = useState(true);
  const [showQr, setShowQr] = useState(false);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (isOpen) {
      const id = getIdentityUUID();
      const key = getIdentityPassphrase();
      setUuid(id);
      setPassphrase(key);
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      setShareUrl(`${origin}/share?uuid=${id}`);
      setIsFirstShare(!localStorage.getItem(FIRST_SHARE_KEY));
      setCopiedLink(false);
      setCopiedKey(false);
      setSavedConfirmed(false);
      setShowQr(false);
    }
  }, [isOpen]);

  // Render QR code when toggled
  useEffect(() => {
    if (showQr && qrCanvasRef.current && uuid && passphrase) {
      // Encode as deep link URL so native camera app can open TimeHarbor directly
      const payload = `timeharbor://share?uuid=${uuid}&key=${encodeURIComponent(passphrase)}`;
      QRCode.toCanvas(qrCanvasRef.current, payload, {
        width: 180,
        margin: 2,
        color: { dark: '#1a1a1a', light: '#ffffff' },
      });
    }
  }, [showQr, uuid, passphrase]);

  const copyToClipboard = useCallback(async (text: string, type: 'link' | 'key') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'link') {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      } else {
        setCopiedKey(true);
        setTimeout(() => setCopiedKey(false), 2000);
      }
    } catch {
      // Clipboard API not available
    }
  }, []);

  const exportKeyFile = useCallback(() => {
    const content = [
      'TimeHarbor Sync Key',
      '===================',
      '',
      `UUID: ${uuid}`,
      `Share URL: ${shareUrl}`,
      `Encryption Key: ${passphrase}`,
      '',
      'Keep this file safe. Anyone with this key can decrypt your synced data.',
      `Exported: ${new Date().toISOString()}`,
    ].join('\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'timeharbor-sync-key.txt';
    a.click();
    URL.revokeObjectURL(url);
  }, [uuid, shareUrl, passphrase]);

  const handleDone = useCallback(() => {
    localStorage.setItem(FIRST_SHARE_KEY, '1');
    onClose();
  }, [onClose]);

  const canClose = !isFirstShare || savedConfirmed;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Share My Link">
      <div className="flex flex-col gap-5">
        <p className="text-sm text-muted-foreground">
          Share this link and key with someone to give them access to your synced data.
          The key is required to decrypt your data — keep it safe.
        </p>

        {/* Share URL */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium" id="share-url-label">Share URL</label>
          <div className="flex gap-2">
            <Input
              value={shareUrl}
              readOnly
              className="font-mono text-xs"
              aria-labelledby="share-url-label"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => copyToClipboard(shareUrl, 'link')}
              aria-label="Copy share URL"
            >
              {copiedLink ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        {/* Encryption Key — only shown on first share */}
        {isFirstShare && (
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium" id="encryption-key-label">Encryption Key</label>
            <div className="flex gap-2">
              <Input
                value={copiedKey ? passphrase : '\u2022'.repeat(passphrase.length)}
                readOnly
                className="font-mono text-xs"
                aria-labelledby="encryption-key-label"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(passphrase, 'key')}
                aria-label="Copy encryption key"
              >
                {copiedKey ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        )}

        {/* UUID (info) */}
        <div className="rounded-md bg-muted p-3">
          <p className="text-xs text-muted-foreground">
            <span className="font-medium">Your UUID:</span>{' '}
            <code className="text-xs">{uuid}</code>
          </p>
        </div>

        {/* QR Code for device pairing */}
        <div className="flex flex-col items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowQr(!showQr)}
            className="gap-2"
          >
            <QrCode className="w-4 h-4" />
            {showQr ? 'Hide QR Code' : 'Show QR Code'}
          </Button>
          {showQr && (
            <div className="rounded-lg border bg-white p-2">
              <canvas ref={qrCanvasRef} aria-label="QR code for device pairing" />
              <p className="text-[10px] text-muted-foreground text-center mt-1">
                Scan from another device to pair
              </p>
            </div>
          )}
        </div>

        {/* Export actions */}
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={exportKeyFile}>
            <Download className="w-4 h-4 mr-2" />
            Export to File
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => {
              copyToClipboard(shareUrl, 'link');
            }}
          >
            <Share2 className="w-4 h-4 mr-2" />
            Copy All
          </Button>
        </div>

        {/* First-share mandatory save confirmation */}
        {isFirstShare && (
          <Alert aria-live="polite">
            <AlertDescription>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={savedConfirmed}
                  onChange={(e) => setSavedConfirmed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300"
                  aria-label="I have saved my encryption key"
                />
                <span className="text-sm">
                  I have saved my encryption key. I understand that without it,
                  no one (including me) can decrypt my synced data on another device.
                </span>
              </label>
            </AlertDescription>
          </Alert>
        )}

        <Button
          onClick={handleDone}
          disabled={isFirstShare && !savedConfirmed}
          className="w-full"
        >
          Done
        </Button>
      </div>
    </Modal>
  );
}
