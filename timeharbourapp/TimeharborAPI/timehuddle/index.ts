import { apiFetch } from '../identity';

export interface TimehudleConnectionStatus {
  connected: boolean;
  timehudleEmail?: string;
  timehudleName?: string;
  connectedAt?: string;
}

export const getTimehudleStatus = async (): Promise<TimehudleConnectionStatus> => {
  const res = await apiFetch('/v1/timehuddle/status');
  if (!res.ok) throw new Error('Failed to fetch TimeHuddle status');
  return res.json() as Promise<TimehudleConnectionStatus>;
};

export const connectTimehuddle = async (
  token: string
): Promise<{ connected: boolean; timehudleEmail: string; timehudleName: string }> => {
  const res = await apiFetch('/v1/timehuddle/connect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  const data = (await res.json()) as { connected: boolean; timehudleEmail: string; timehudleName: string; error?: string };
  if (!res.ok) throw new Error(data.error ?? 'Connection failed');
  return data;
};

export const disconnectTimehuddle = async (): Promise<void> => {
  const res = await apiFetch('/v1/timehuddle/disconnect', { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to disconnect');
};
