'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, Link2, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { Button, Text } from '@mieweb/ui';
import {
  getTimehudleStatus,
  disconnectTimehuddle,
  startTimehudleOAuth,
  type TimehudleConnectionStatus,
} from '@/TimeharborAPI/timehuddle';

export default function TimehudlePage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [status, setStatus] = useState<TimehudleConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadStatus = async () => {
    try {
      const s = await getTimehudleStatus();
      setStatus(s);
    } catch {
      setStatus({ connected: false });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Handle OAuth callback result passed as query params
    const connected = searchParams.get('connected');
    const error = searchParams.get('error');
    if (connected === 'true') {
      setMessage({ type: 'success', text: 'Successfully connected to TimeHuddle!' });
    } else if (error) {
      const msgs: Record<string, string> = {
        invalid_state: 'Connection request expired or was tampered with. Please try again.',
        token_exchange_failed: 'Could not complete sign-in with TimeHuddle. Please try again.',
        access_denied: 'You declined the TimeHuddle connection request.',
      };
      setMessage({ type: 'error', text: msgs[error] ?? `Connection failed: ${error}` });
    }
    void loadStatus();
  }, [searchParams]);

  const [connecting, setConnecting] = useState(false);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const authorizeUrl = await startTimehudleOAuth();
      window.location.href = authorizeUrl;
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to start connection' });
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    setMessage(null);
    try {
      await disconnectTimehuddle();
      setStatus({ connected: false });
      setMessage({ type: 'success', text: 'Disconnected from TimeHuddle' });
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Disconnect failed' });
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-full hover:bg-muted transition-colors"
          aria-label="Go back"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <Link2 className="w-5 h-5 text-muted-foreground" />
          <h1 className="text-xl font-bold">TimeHuddle Connection</h1>
        </div>
      </div>

      <div className="px-4 space-y-6">
        {/* Connection status */}
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <Text>Checking connection…</Text>
          </div>
        ) : status?.connected ? (
          <div className="rounded-xl border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30 p-4 space-y-3">
            <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
              <CheckCircle2 className="w-5 h-5" />
              <Text className="font-semibold">Connected</Text>
            </div>
            {status.timehudleName && (
              <Text className="text-sm">{status.timehudleName}</Text>
            )}
            {status.timehudleEmail && (
              <Text className="text-sm text-muted-foreground">{status.timehudleEmail}</Text>
            )}
            {status.connectedAt && (
              <Text className="text-xs text-muted-foreground">
                Since {new Date(status.connectedAt).toLocaleDateString()}
              </Text>
            )}
            <Button
              variant="danger"
              size="sm"
              onClick={() => void handleDisconnect()}
              disabled={disconnecting}
              isLoading={disconnecting}
              loadingText="Disconnecting…"
            >
              Disconnect
            </Button>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-muted/30 p-4 flex items-center gap-2 text-muted-foreground">
            <XCircle className="w-5 h-5" />
            <Text>Not connected</Text>
          </div>
        )}

        {/* Connect / reconnect */}
        <div className="space-y-3">
          <div className="space-y-1">
            <Text className="font-semibold">
              {status?.connected ? 'Reconnect with TimeHuddle' : 'Connect your TimeHuddle account'}
            </Text>
            <Text className="text-sm text-muted-foreground">
              You will be taken to TimeHuddle to sign in and authorise the connection.
            </Text>
          </div>

          <Button
            onClick={() => void handleConnect()}
            className="w-full"
            disabled={connecting}
            isLoading={connecting}
            loadingText="Connecting…"
            aria-label="Connect to TimeHuddle via OAuth"
          >
            <Link2 className="w-4 h-4 mr-2" />
            {status?.connected ? 'Reconnect with TimeHuddle' : 'Connect with TimeHuddle'}
          </Button>
        </div>

        {/* Feedback message */}
        {message && (
          <div
            className={`rounded-lg px-4 py-3 text-sm ${
              message.type === 'success'
                ? 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400'
                : 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400'
            }`}
            role="status"
          >
            {message.text}
          </div>
        )}
      </div>
    </div>
  );
}

