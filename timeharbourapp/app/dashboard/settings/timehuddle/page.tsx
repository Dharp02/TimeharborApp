'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Link2, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { Button, Textarea, Text } from '@mieweb/ui';
import {
  getTimehudleStatus,
  connectTimehuddle,
  disconnectTimehuddle,
  type TimehudleConnectionStatus,
} from '@/TimeharborAPI/timehuddle';

export default function TimehudlePage() {
  const router = useRouter();

  const [status, setStatus] = useState<TimehudleConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState('');
  const [connecting, setConnecting] = useState(false);
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

  useEffect(() => { void loadStatus(); }, []);

  const handleConnect = async () => {
    const trimmed = token.trim();
    if (!trimmed) return;
    setConnecting(true);
    setMessage(null);
    try {
      const result = await connectTimehuddle(trimmed);
      setStatus({ connected: true, timehudleEmail: result.timehudleEmail, timehudleName: result.timehudleName });
      setToken('');
      setMessage({ type: 'success', text: `Connected as ${result.timehudleEmail}` });
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Connection failed' });
    } finally {
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

        {/* Connect form — always visible so user can reconnect */}
        <div className="space-y-4">
          <div className="space-y-1">
            <Text className="font-semibold">
              {status?.connected ? 'Reconnect with a new token' : 'Connect your TimeHuddle account'}
            </Text>
            <Text className="text-sm text-muted-foreground">
              In TimeHuddle, go to <strong>Settings → API Tokens</strong>, generate a new token, and paste it below.
            </Text>
          </div>

          <Textarea
            placeholder="th_pat_…"
            value={token}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setToken(e.target.value)}
            rows={3}
            className="font-mono text-sm"
            aria-label="TimeHuddle personal access token"
          />

          <Button
            onClick={() => void handleConnect()}
            disabled={!token.trim() || connecting}
            isLoading={connecting}
            loadingText="Connecting…"
            className="w-full"
          >
            Connect to TimeHuddle
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
