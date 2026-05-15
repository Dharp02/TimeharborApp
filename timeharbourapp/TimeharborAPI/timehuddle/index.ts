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

export const startTimehudleOAuth = async (): Promise<string> => {
  const res = await apiFetch('/v1/timehuddle/oauth/start');
  if (!res.ok) throw new Error('Failed to start TimeHuddle OAuth');
  const data = await res.json() as { authorizeUrl: string };
  return data.authorizeUrl;
};

export const disconnectTimehuddle = async (): Promise<void> => {
  const res = await apiFetch('/v1/timehuddle/disconnect', { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to disconnect');
};
