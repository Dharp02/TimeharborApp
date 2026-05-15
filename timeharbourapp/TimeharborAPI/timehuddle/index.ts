import { apiFetch } from '../identity';
import { db } from '../db';
import type { Ticket } from '../tickets';

export interface TimehudleConnectionStatus {
  connected: boolean;
  timehudleEmail?: string;
  timehudleName?: string;
  connectedAt?: string;
}

export interface TimehudleTeam {
  id: string;
  name: string;
  description?: string | null;
  memberCount: number;
}

export interface TimehudleLinkedTeam {
  teamId: string;
  teamName: string;
  linkedAt: string;
}

/** Status mapping: TimeHuddle → TimeHarbor */
const STATUS_MAP: Record<string, Ticket['status']> = {
  'open': 'Open',
  'in-progress': 'In Progress',
  'blocked': 'In Progress',
  'reviewed': 'In Progress',
  'closed': 'Closed',
};

/** Priority mapping: TimeHuddle → TimeHarbor */
const PRIORITY_MAP: Record<string, Ticket['priority']> = {
  'low': 'Low',
  'medium': 'Medium',
  'high': 'High',
  'critical': 'High',
};

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

// ── Teams ─────────────────────────────────────────────────────────────────────

export const getTimehudleTeams = async (): Promise<TimehudleTeam[]> => {
  const res = await apiFetch('/v1/timehuddle/teams');
  if (!res.ok) throw new Error('Failed to fetch TimeHuddle teams');
  const data = await res.json() as { teams: TimehudleTeam[] };
  return data.teams;
};

export const getTimehudleLinkedTeams = async (): Promise<TimehudleLinkedTeam[]> => {
  const res = await apiFetch('/v1/timehuddle/linked-teams');
  if (!res.ok) throw new Error('Failed to fetch linked teams');
  const data = await res.json() as { linkedTeams: TimehudleLinkedTeam[] };
  return data.linkedTeams;
};

export const linkTimehudleTeam = async (teamId: string, teamName: string): Promise<void> => {
  const res = await apiFetch('/v1/timehuddle/linked-teams', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ teamId, teamName }),
  });
  if (!res.ok) throw new Error('Failed to link team');
};

export const unlinkTimehudleTeam = async (teamId: string): Promise<void> => {
  const res = await apiFetch(`/v1/timehuddle/linked-teams/${encodeURIComponent(teamId)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to unlink team');
};

// ── Ticket sync ───────────────────────────────────────────────────────────────

/**
 * Pull ALL tickets flagged sharedWithTimeharbor=true from TimeHuddle,
 * across every team the user belongs to — no team linking required.
 * Returns the count of upserted tickets.
 */
export const syncAllTimehudleSharedTickets = async (): Promise<number> => {
  const status = await getTimehudleStatus();
  if (!status.connected) return 0;

  const res = await apiFetch('/v1/timehuddle/shared-tickets');
  if (!res.ok) return 0;
  const data = await res.json() as { tickets: any[] };

  const sharedIds = new Set<string>();
  let count = 0;
  for (const raw of data.tickets ?? []) {
    if (raw.status === 'deleted') continue;

    sharedIds.add(raw.id);
    const ticket: any = {
      id: raw.id,
      title: raw.title,
      description: raw.description ?? undefined,
      status: STATUS_MAP[raw.status] ?? 'Open',
      priority: PRIORITY_MAP[raw.priority ?? 'medium'] ?? 'Medium',
      link: raw.github || undefined,
      teamId: raw.teamId,
      teamName: raw.teamName ?? raw.teamId,
      createdBy: raw.createdBy,
      createdByName: raw.createdByName ?? undefined,
      assignedTo: raw.assignedTo ?? undefined,
      assignedToName: raw.assignedToName ?? undefined,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt ?? raw.createdAt,
      source: 'timehuddle' as const,
      syncedWithTimehuddle: true,
      _disconnected: 0,
    };

    await db.tickets.put(ticket);
    count++;
  }

  // Remove tickets that were previously synced as "shared" but are no longer flagged
  // (user unflagged or deleted the ticket in TimeHuddle).
  // Only targets timehuddle tickets with syncedWithTimehuddle=true that are not in the
  // current shared list — linked-team tickets that are flagged will be present in sharedIds.
  const staleKeys = await db.tickets
    .filter((t: any) => t.source === 'timehuddle' && t.syncedWithTimehuddle === true && !sharedIds.has(t.id))
    .primaryKeys();
  if (staleKeys.length > 0) {
    await db.tickets.bulkDelete(staleKeys as string[]);
  }

  return count;
};

/**
 * Pull tickets for a single linked team from the TimeHarbor backend proxy,
 * map fields, and upsert into Dexie. Returns the count of upserted tickets.
 *
 * Sync strategy: ONE-WAY PULL only. Changes made locally on these tickets
 * are stored with _syncEnabled: 0 and never pushed back automatically.
 * The user must explicitly select op-log entries to push back to TimeHuddle.
 */
export const syncTimehudleTeamTickets = async (teamId: string, teamName: string): Promise<number> => {
  const res = await apiFetch(`/v1/timehuddle/linked-teams/${encodeURIComponent(teamId)}/tickets`);
  if (!res.ok) throw new Error(`Failed to fetch tickets for team ${teamId}`);
  const data = await res.json() as { tickets: any[] };

  const activeIds = new Set<string>();
  let count = 0;
  for (const raw of data.tickets ?? []) {
    if (raw.status === 'deleted') continue;

    activeIds.add(raw.id);
    const ticket: any = {
      id: raw.id,
      title: raw.title,
      description: raw.description ?? undefined,
      status: STATUS_MAP[raw.status] ?? 'Open',
      priority: PRIORITY_MAP[raw.priority ?? 'medium'] ?? 'Medium',
      link: raw.github || undefined,
      teamId,
      teamName,
      createdBy: raw.createdBy,
      createdByName: raw.createdByName ?? undefined,
      assignedTo: raw.assignedTo ?? undefined,
      assignedToName: raw.assignedToName ?? undefined,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt ?? raw.createdAt,
      source: 'timehuddle' as const,
      syncedWithTimehuddle: raw.sharedWithTimeharbor ?? false,
      // Clear disconnected flag on fresh pull — team is still linked
      _disconnected: 0,
    };

    await db.tickets.put(ticket);
    count++;
  }

  // Remove tickets that were deleted in TimeHuddle (no longer in the team's list)
  const staleKeys = await db.tickets
    .filter((t: any) => t.source === 'timehuddle' && t.teamId === teamId && !activeIds.has(t.id))
    .primaryKeys();
  if (staleKeys.length > 0) {
    await db.tickets.bulkDelete(staleKeys as string[]);
  }

  return count;
};

/**
 * Mark all tickets from a given team (or all timehuddle tickets if no teamId)
 * as disconnected. They remain readable but show a "Disconnected" badge and
 * cannot be edited until the team is re-linked.
 */
export const markTimehudleTicketsDisconnected = async (teamId?: string): Promise<void> => {
  const query = teamId
    ? db.tickets.where('teamId').equals(teamId)
    : db.tickets.filter((t: any) => t.source === 'timehuddle');
  await query.modify({ _disconnected: 1 } as any);
};

