'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Video, Loader2, X, ExternalLink, Copy, Check } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import QRCode from 'qrcode';
import { Modal } from '@/components/ui/Modal';
import { pulse as pulseApi } from '@/TimeharborAPI';
import type { RecordingSession, PulseAttachment } from '@/TimeharborAPI/pulse';

interface PulseButtonProps {
  teamId: string;
  ticketId: string;
}

const PULSE_APP_STORE_URL = 'https://apps.apple.com/za/app/pulse-cam/id6748621024';
const PULSE_PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.mieweb.pulse';

/**
 * Tries to open the `pulsecam://` deeplink via the OS.
 * Uses the Capacitor App plugin to detect whether the app went to background
 * (meaning Pulse Cam opened) or stayed in foreground (not installed).
 * Falls back to document.visibilitychange on web.
 */
async function openDeeplinkWithStoreFallback(deeplink: string) {
  const platform = Capacitor.getPlatform(); // 'ios' | 'android' | 'web'
  const storeUrl = platform === 'android' ? PULSE_PLAY_STORE_URL : PULSE_APP_STORE_URL;

  if (!Capacitor.isNativePlatform()) {
    window.open(deeplink, '_blank');
    return;
  }

  // On native: listen for the app going to background via Capacitor App plugin.
  // WKWebView (iOS) does NOT fire visibilitychange on app-switch —
  // Capacitor's appStateChange is the correct event for this.
  let wentToBackground = false;

  const listener = await CapacitorApp.addListener('appStateChange', ({ isActive }) => {
    if (!isActive) {
      // App moved to background — Pulse Cam launched successfully
      wentToBackground = true;
      listener.remove();
    }
  });

  // Fire the deeplink — if Pulse Cam is installed the OS opens it
  window.open(deeplink, '_system');

  // Give the OS 1.5s to respond. If still in foreground, app is not installed.
  // Use window.location.href (not window.open) — iOS blocks window.open from
  // setTimeout callbacks since they lack a direct user-gesture context.
  setTimeout(() => {
    listener.remove();
    if (!wentToBackground) {
      window.location.href = storeUrl;
    }
  }, 1500);
}

/**
 * Pulse recording button that sits beside each ticket.
 *
 * Mobile (Capacitor native): tapping the button calls the backend, then
 *   opens the `pulsecam://` deeplink via the OS — Pulse Cam launches natively.
 *   If Pulse Cam is not installed, automatically redirects to the App Store
 *   (iOS) or Play Store (Android).
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

  // Load existing uploaded shorts count on mount
  const loadAttachments = useCallback(async () => {
    try {
      const data = await pulseApi.listAttachments(teamId, ticketId);
      setAttachments(data);
    } catch {
      // Non-critical — badge just won't show a count
    }
  }, [teamId, ticketId]);

  // Check if there's an in-progress recording session for this ticket
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

  // Render QR code into the canvas when the modal opens
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
        // Fire and forget — don't await so loading clears immediately.
        // The store fallback fires asynchronously after 1.5s if needed.
        openDeeplinkWithStoreFallback(result.deeplink);
      } else {
        // Desktop / web: show the QR code modal
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
    // Refresh attachments and pending state when modal closes —
    // the user may have just uploaded a Short and completed the session
    setTimeout(() => {
      loadAttachments();
      loadPending();
    }, 2000);
  };

  return (
    <>
      {/* Pulse button with optional "uploaded" count badge */}
      <div className="relative">
        <button
          onClick={handleClick}
          disabled={loading}
          aria-label={hasPending ? 'Continue Pulse recording for this ticket' : 'Record a Pulse Short for this ticket'}
          title={hasPending ? 'Continue Recording' : 'Record a Pulse Short'}
          className={`p-2 rounded-full transition-colors disabled:opacity-50 ${
            hasPending
              ? 'bg-amber-50 text-amber-600 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:hover:bg-amber-900/40'
              : 'bg-purple-50 text-purple-600 hover:bg-purple-100 dark:bg-purple-900/20 dark:text-purple-400 dark:hover:bg-purple-900/40'
          }`}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Video className="w-4 h-4" />
          )}
        </button>

        {/* Badge: count of uploaded Shorts */}
        {attachments.length > 0 && (
          <span
            aria-label={`${attachments.length} Pulse Short${attachments.length > 1 ? 's' : ''} attached`}
            className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-purple-600 text-white text-[9px] font-bold flex items-center justify-center leading-none"
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
            <button
              onClick={handleCopyLink}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
              aria-label="Copy Pulse Cam link to clipboard"
            >
              {copied ? (
                <><Check className="w-4 h-4 text-green-500" /> Copied!</>
              ) : (
                <><Copy className="w-4 h-4" /> Copy Link</>
              )}
            </button>

            {/* Open in browser (fallback for desktop) */}
            {session?.deeplink && (
              <a
                href={session.deeplink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
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
                      <div className="w-12 h-8 rounded bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                        <Video className="w-4 h-4 text-purple-500" />
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
                        className="p-1.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-900/60 transition-colors shrink-0"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                    <button
                      onClick={async () => {
                        await pulseApi.deleteAttachment(teamId, ticketId, a.id);
                        loadAttachments();
                      }}
                      aria-label="Remove this Pulse Short attachment"
                      className="p-1.5 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
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
