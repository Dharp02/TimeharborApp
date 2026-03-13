'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Video, Loader2, X, ExternalLink, Copy, Check } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Button } from '@mieweb/ui';
import QRCode from 'qrcode';
import { Modal } from '@/components/ui/Modal';
import { pulse as pulseApi } from '@/TimeharborAPI';
import type { RecordingSession, PulseAttachment } from '@/TimeharborAPI/pulse';

interface PulseButtonProps {
  teamId: string;
  ticketId: string;
}

/**
 * Pulse recording button that sits beside each ticket.
 *
 * Mobile (Capacitor native): tapping the button calls the backend, then
 *   opens the `pulsecam://` deeplink via the OS — Pulse Cam launches natively.
 *
 * Desktop / web: shows a QR code modal so the user can scan with their phone
 *   to open Pulse Cam there, plus a fallback copy-link button.
 *
 * A badge shows how many Shorts have already been uploaded for this ticket.
 */
export default function PulseButton({ teamId, ticketId }: PulseButtonProps) {
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<RecordingSession | null>(null);
  const [attachments, setAttachments] = useState<PulseAttachment[]>([]);
  const [hasPending, setHasPending] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const isNative = Capacitor.isNativePlatform();

  const loadAttachments = useCallback(async () => {
    try {
      const data = await pulseApi.listAttachments(teamId, ticketId);
      setAttachments(data);
    } catch {
      // Non-critical — badge just won't show a count
    }
  }, [teamId, ticketId]);

  const loadPending = useCallback(async () => {
    try {
      const pending = await pulseApi.listPending(teamId, ticketId);
      setHasPending(pending.length > 0);
    } catch {
      // Non-critical
    }
  }, [teamId, ticketId]);

  useEffect(() => {
    loadAttachments();
    loadPending();
  }, [loadAttachments, loadPending]);

  useEffect(() => {
    if (qrModalOpen && session?.qrData && canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, session.qrData, {
        width: 220,
        margin: 2,
        color: { dark: '#111827', light: '#ffffff' },
      }).catch(console.error);
    }
  }, [qrModalOpen, session]);

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (loading) return;

    setLoading(true);
    try {
      const result = await pulseApi.requestRecording(teamId, ticketId);
      setSession(result);

      if (isNative) {
        window.open(result.deeplink, '_system');
      } else {
        setQrModalOpen(true);
      }
    } catch (err) {
      console.error('Failed to start Pulse recording:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async () => {
    if (!session?.deeplink) return;
    try {
      await navigator.clipboard.writeText(session.deeplink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard not available — swallow silently
    }
  };

  const handleCloseModal = () => {
    setQrModalOpen(false);
    setTimeout(() => {
      loadAttachments();
      loadPending();
    }, 2000);
  };

  return (
    <>
      {/* Pulse button with optional "uploaded" count badge */}
      <div className="relative">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleClick}
          disabled={loading}
          aria-label={hasPending ? 'Continue Pulse recording for this ticket' : 'Record a Pulse Short for this ticket'}
          title={hasPending ? 'Continue Recording' : 'Record a Pulse Short'}
          className={`p-2 rounded-full transition-colors disabled:opacity-50 ${
            hasPending
              ? 'bg-amber-50 text-amber-600 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:hover:bg-amber-900/40'
              : 'bg-primary-50 text-primary-600 hover:bg-primary-100 dark:bg-primary-900/20 dark:text-primary-400 dark:hover:bg-primary-900/40'
          }`}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Video className="w-4 h-4" />
          )}
        </Button>

        {/* Badge: count of uploaded Shorts */}
        {attachments.length > 0 && (
          <span
            aria-label={`${attachments.length} Pulse Short${attachments.length > 1 ? 's' : ''} attached`}
            className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary-600 text-white text-[9px] font-bold flex items-center justify-center leading-none"
          >
            {attachments.length > 9 ? '9+' : attachments.length}
          </span>
        )}
      </div>

      {/* QR code modal — shown on desktop / web only */}
      <Modal
        isOpen={qrModalOpen}
        onClose={handleCloseModal}
        title={session?.resumed ? 'Continue Recording' : 'Record a Pulse Short'}
      >
        <div className="flex flex-col items-center gap-4">
          <p className="text-sm text-gray-600 dark:text-gray-300 text-center">
            {session?.resumed
              ? 'Scan to continue your previous Pulse recording for this ticket.'
              : 'Scan this QR code with your phone to open Pulse Cam and record a Short for this ticket.'}
          </p>

          {/* QR canvas */}
          <div className="p-3 bg-white rounded-xl border border-gray-200 dark:border-gray-600 shadow-sm">
            <canvas ref={canvasRef} aria-label="QR code for Pulse Cam deeplink" />
          </div>

          <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
            Expires {session?.expiresAt
              ? new Date(session.expiresAt).toLocaleString()
              : 'in 24 hours'}
          </p>

          <div className="flex w-full gap-2">
            {/* Copy deeplink */}
            <Button
              variant="outline"
              onClick={handleCopyLink}
              className="flex-1 flex items-center justify-center gap-2"
              aria-label="Copy Pulse Cam link to clipboard"
            >
              {copied ? (
                <><Check className="w-4 h-4 text-green-500" /> Copied!</>
              ) : (
                <><Copy className="w-4 h-4" /> Copy Link</>
              )}
            </Button>

            {/* Open in browser (fallback for desktop) */}
            {session?.deeplink && (
              <a
                href={session.deeplink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                aria-label="Open Pulse Cam directly"
              >
                <ExternalLink className="w-4 h-4" /> Open Pulse Cam
              </a>
            )}
          </div>

          {/* List of already-uploaded Shorts for this ticket */}
          {attachments.length > 0 && (
            <div className="w-full mt-2">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                Attached Shorts ({attachments.length})
              </p>
              <ul className="space-y-2">
                {attachments.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 p-2 rounded-lg bg-gray-50 dark:bg-gray-700/40">
                    {a.thumbnailUrl ? (
                      <img
                        src={a.thumbnailUrl}
                        alt="Short thumbnail"
                        className="w-12 h-8 object-cover rounded"
                      />
                    ) : (
                      <div className="w-12 h-8 rounded bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                        <Video className="w-4 h-4 text-primary-500" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">
                        {a.title || 'Pulse Short'}
                      </p>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500">
                        {a.uploadedAt
                          ? new Date(a.uploadedAt).toLocaleDateString()
                          : ''}
                      </p>
                    </div>
                    {a.watchUrl && (
                      <a
                        href={a.watchUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Watch ${a.title || 'Pulse Short'}`}
                        className="p-1.5 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 hover:bg-primary-200 dark:hover:bg-primary-900/60 transition-colors shrink-0"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={async () => {
                        await pulseApi.deleteAttachment(teamId, ticketId, a.id);
                        loadAttachments();
                      }}
                      aria-label="Remove this Pulse Short attachment"
                      className="p-1.5 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
