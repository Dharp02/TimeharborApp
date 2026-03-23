import { db, type DexieWorkSession, type SyncMeta } from './db';
import { getApiUrl } from './apiUrl';

/**
 * SyncEngine — push/pull work sessions and tickets
 * between Dexie (client) and the Fastify/MongoDB backend.
 */

async function apiRequest(path: string, options: RequestInit = {}) {
  const base = getApiUrl().replace(/\/api\/?$/, '');
  const url = `${base}/api/timeharbor${path}`;
  const res = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-App-Id': 'timeharbor',
      ...options.headers,
    },
  });
  if (!res.ok) {
    throw new Error(`SyncEngine: ${res.status} ${res.statusText} — ${path}`);
  }
  return res.json();
}

async function getLastPulledAt(collection: string): Promise<string | null> {
  const meta = await db.syncMeta.get(collection);
  return meta?.lastPulledAt ?? null;
}

async function setLastPulledAt(collection: string, isoTime: string) {
  await db.syncMeta.put({ collection, lastPulledAt: isoTime });
}

// ── Push Sessions ──

export async function pushSessions() {
  const dirty = await db.workSessions
    .where('_dirty')
    .equals(1)
    .toArray();

  if (dirty.length === 0) return;

  const sessions = dirty.map((s) => ({
    clientSessionId: s.clientSessionId,
    date: s.date,
    clockIn: s.clockIn,
    clockOut: s.clockOut,
    ticketSegments: s.ticketSegments,
    breaks: s.breaks,
    totalSessionMs: s.totalSessionMs,
    totalBreakMs: s.totalBreakMs,
    netWorkMs: s.netWorkMs,
    ticketBreakdown: s.ticketBreakdown,
    comment: s.comment,
    sourceApp: s.sourceApp,
    _rev: s._rev,
  }));

  const result = await apiRequest('/time/sync-sessions', {
    method: 'POST',
    body: JSON.stringify({ sessions }),
  });

  // Mark as clean
  await db.workSessions
    .where('_dirty')
    .equals(1)
    .modify({ _dirty: 0 });

  return result;
}

// ── Pull Sessions ──

export async function pullSessions() {
  const since = await getLastPulledAt('workSessions');
  const params = since ? `?since=${encodeURIComponent(since)}` : '';

  const { sessions, serverTime } = await apiRequest(`/time/sessions${params}`);

  for (const remote of sessions as Array<any>) {
    const local = await db.workSessions
      .where('clientSessionId')
      .equals(remote.clientSessionId)
      .first();

    if (local) {
      // Skip if local has unsync'd changes
      if (local._dirty === 1) continue;
      // Take server version if higher _rev
      if (remote._rev > local._rev) {
        await db.workSessions.update(local.id, {
          ...remote,
          id: local.id, // keep local Dexie id
          _dirty: 0,
        });
      }
    } else {
      // New session from server
      await db.workSessions.add({
        ...remote,
        id: remote.clientSessionId, // use clientSessionId as Dexie key
        _serverId: remote._id,
        _dirty: 0,
      });
    }
  }

  if (serverTime) {
    await setLastPulledAt('workSessions', serverTime);
  }
}

// ── Push Tickets ──

export async function pushTickets() {
  const dirty = await db.tickets
    .filter((t) => (t as any)._dirty === 1)
    .toArray();

  if (dirty.length === 0) return;

  const tickets = dirty.map((t: any) => ({
    _serverId: t._serverId,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    link: t.link,
    projectId: t.projectId,
    fieldTimestamps: t.fieldTimestamps ?? {},
    _deleted: t._deleted ?? false,
    _rev: t._rev ?? 1,
  }));

  const result = await apiRequest('/sync/push', {
    method: 'POST',
    body: JSON.stringify({ tickets }),
  });

  // Mark as clean
  for (const t of dirty) {
    await db.tickets.update(t.id, { _dirty: 0 } as any);
  }

  return result;
}

// ── Pull Tickets ──

export async function pullTickets() {
  const since = await getLastPulledAt('tickets');

  const { tickets, serverTime } = await apiRequest('/sync/pull', {
    method: 'POST',
    body: JSON.stringify({ lastPulledAt: since }),
  });

  for (const remote of tickets as Array<any>) {
    const serverId = remote._id.toString();
    const local = await db.tickets
      .filter((t: any) => t._serverId === serverId)
      .first();

    if (local) {
      if ((local as any)._dirty === 1) continue;
      await db.tickets.update(local.id, {
        ...remote,
        id: local.id,
        _serverId: serverId,
        _dirty: 0,
      } as any);
    } else {
      await db.tickets.add({
        ...remote,
        id: serverId,
        _serverId: serverId,
        _dirty: 0,
      } as any);
    }
  }

  if (serverTime) {
    await setLastPulledAt('tickets', serverTime);
  }
}

// ── Full Sync Cycle ──

export async function syncAll() {
  try {
    await pushSessions();
    await pushTickets();
    await pullSessions();
    await pullTickets();
  } catch (err) {
    console.warn('SyncEngine: sync failed (will retry)', err);
  }
}
