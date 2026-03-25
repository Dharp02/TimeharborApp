import { db, type DexieWorkSession, type SyncMeta } from './db';
import { getApiUrl } from './apiUrl';
import { formatDuration } from '@timeharbor/time-engine';
import { syncPendingAvatar } from './auth';

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
    links: s.links,
    attachments: s.attachments,
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
    .where('_dirty')
    .equals(1)
    .toArray();

  if (dirty.length === 0) return;

  const tickets = dirty.map((t: any) => ({
    clientId: t.id,
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

  const { accepted, serverIds } = await apiRequest('/sync/push', {
    method: 'POST',
    body: JSON.stringify({ tickets }),
  }) as { accepted: number; serverIds?: Record<string, string> };

  // Mark as clean and store serverIds returned by backend
  for (let i = 0; i < dirty.length; i++) {
    const t = dirty[i];
    const sid = serverIds?.[t.id];
    await db.tickets.update(t.id, {
      _dirty: 0,
      ...(sid ? { _serverId: sid } : {}),
    } as any);
  }
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
      .where('_serverId')
      .equals(serverId)
      .first();

    if (local) {
      if ((local as any)._dirty === 1) continue;
      await db.tickets.update(local.id, {
        title: remote.title,
        description: remote.description,
        status: remote.status,
        priority: remote.priority,
        link: remote.link,
        projectId: remote.projectId,
        fieldTimestamps: remote.fieldTimestamps,
        _deleted: remote._deleted ?? false,
        _rev: remote._rev,
        _serverId: serverId,
        _dirty: 0,
        teamId: (local as any).teamId || '__personal__',
        updatedAt: remote.updatedAt,
      } as any);
    } else {
      await db.tickets.add({
        id: serverId,
        _serverId: serverId,
        title: remote.title,
        description: remote.description,
        status: remote.status,
        priority: remote.priority,
        link: remote.link,
        projectId: remote.projectId,
        createdBy: remote.createdBy,
        fieldTimestamps: remote.fieldTimestamps,
        _deleted: remote._deleted ?? false,
        _rev: remote._rev,
        _dirty: 0,
        teamId: '__personal__',
        createdAt: remote.createdAt,
        updatedAt: remote.updatedAt,
      } as any);
    }
  }

  if (serverTime) {
    await setLastPulledAt('tickets', serverTime);
  }
}

// ── Re-push sessions with links/attachments that were previously synced without them ──
async function migrateLinksAttachments() {
  try {
    const sessions = await db.workSessions
      .where('_dirty')
      .equals(0)
      .filter(s => (s.links && s.links.length > 0) || (s.attachments && s.attachments.length > 0))
      .toArray();
    for (const s of sessions) {
      await db.workSessions.update(s.id, { _dirty: 1, _rev: s._rev + 1 });
    }
  } catch (_) { /* ignore */ }
}

// ── Recompute ticket tracked times from session data ──

async function recomputeTicketTrackedTimes() {
  try {
    const allSessions = await db.workSessions.toArray();
    const totals: Record<string, number> = {};
    for (const session of allSessions) {
      if (!session.ticketBreakdown) continue;
      for (const tb of session.ticketBreakdown) {
        totals[tb.ticketId] = (totals[tb.ticketId] || 0) + tb.totalMs;
      }
    }
    for (const [ticketId, totalMs] of Object.entries(totals)) {
      try {
        await db.tickets.update(ticketId, {
          trackedMs: totalMs,
          trackedTime: formatDuration(totalMs),
        });
      } catch (_) { /* ticket may not exist */ }
    }
  } catch (_) { /* ignore */ }
}

// ── Full Sync Cycle ──

export async function syncAll() {
  try {
    await migrateLinksAttachments();
    await syncPendingAvatar();
    await pushSessions();
    await pushTickets();
    await pushNotes();
    await pushActivityLogs();
    await pullSessions();
    await recomputeTicketTrackedTimes();
    await pullTickets();
    await pullNotes();
    await pullActivityLogs();
  } catch (err) {
    console.warn('SyncEngine: sync failed (will retry)', err);
  } finally {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('sync-complete'));
    }
  }
}

// ── Push Notes ──

export async function pushNotes() {
  const dirty = await db.notes
    .where('_dirty')
    .equals(1)
    .toArray();

  if (dirty.length === 0) return;

  const notes = dirty.map((n) => ({
    clientId: n.id,
    _serverId: n._serverId,
    title: n.title,
    content: n.content,
    _rev: n._rev ?? 1,
    _deleted: n._deleted ?? false,
  }));

  const { serverIds } = await apiRequest('/sync/notes/push', {
    method: 'POST',
    body: JSON.stringify({ notes }),
  }) as { accepted: number; serverIds: Record<string, string> };

  for (const n of dirty) {
    const sid = serverIds?.[n.id];
    await db.notes.update(n.id, { _dirty: 0, ...(sid ? { _serverId: sid } : {}) });
  }
}

// ── Pull Notes ──

export async function pullNotes() {
  const since = await getLastPulledAt('notes');

  const { notes, serverTime } = await apiRequest('/sync/notes/pull', {
    method: 'POST',
    body: JSON.stringify({ lastPulledAt: since }),
  });

  for (const remote of notes as Array<any>) {
    const serverId = remote._id.toString();
    const local = await db.notes
      .filter((n) => n._serverId === serverId)
      .first();

    if (local) {
      if (local._dirty === 1) continue;
      await db.notes.update(local.id, {
        title: remote.title,
        content: remote.content,
        _deleted: remote._deleted ?? false,
        _rev: remote._rev,
        _serverId: serverId,
        _dirty: 0,
        updatedAt: remote.updatedAt,
      });
    } else {
      await db.notes.add({
        id: serverId,
        _serverId: serverId,
        userId: remote.userId,
        title: remote.title,
        content: remote.content,
        _deleted: remote._deleted ?? false,
        _rev: remote._rev,
        _dirty: 0,
        createdAt: remote.createdAt,
        updatedAt: remote.updatedAt,
      });
    }
  }

  if (serverTime) {
    await setLastPulledAt('notes', serverTime);
  }
}

// ── Push Activity Logs ──

export async function pushActivityLogs() {
  const dirty = await db.activityLogs
    .where('_dirty')
    .equals(1)
    .toArray();

  if (dirty.length === 0) return;

  const activities = dirty.map((a) => ({
    clientId: a.id, // Dexie id serves as clientId for dedup
    teamId: a.teamId,
    type: a.type,
    title: a.title,
    subtitle: a.subtitle,
    description: a.description,
    link: a.link,
    startTime: a.startTime,
    endTime: a.endTime,
    status: a.status,
    duration: a.duration,
    durationMs: a.durationMs,
    metadata: a.metadata,
    _rev: a._rev ?? 1,
    _deleted: false,
  }));

  await apiRequest('/sync/activity/push', {
    method: 'POST',
    body: JSON.stringify({ activities }),
  });

  for (const a of dirty) {
    await db.activityLogs.update(a.id, { _dirty: 0 });
  }
}

// ── Pull Activity Logs ──

export async function pullActivityLogs() {
  const since = await getLastPulledAt('activityLogs');

  const { activities, serverTime } = await apiRequest('/sync/activity/pull', {
    method: 'POST',
    body: JSON.stringify({ lastPulledAt: since }),
  });

  for (const remote of activities as Array<any>) {
    const clientId = remote.clientId;
    const local = await db.activityLogs.get(clientId);

    if (local) {
      if (local._dirty === 1) continue;
      await db.activityLogs.update(clientId, {
        teamId: remote.teamId,
        type: remote.type,
        title: remote.title,
        subtitle: remote.subtitle,
        description: remote.description,
        link: remote.link,
        startTime: remote.startTime,
        endTime: remote.endTime,
        status: remote.status,
        duration: remote.duration,
        durationMs: remote.durationMs,
        metadata: remote.metadata,
        _serverId: remote._id?.toString(),
        _rev: remote._rev,
        _dirty: 0,
      });
    } else {
      await db.activityLogs.add({
        id: clientId,
        _serverId: remote._id?.toString(),
        userId: remote.userId,
        teamId: remote.teamId,
        type: remote.type,
        title: remote.title,
        subtitle: remote.subtitle,
        description: remote.description,
        link: remote.link,
        startTime: remote.startTime,
        endTime: remote.endTime,
        status: remote.status,
        duration: remote.duration,
        durationMs: remote.durationMs,
        metadata: remote.metadata,
        _rev: remote._rev,
        _dirty: 0,
      });
    }
  }

  if (serverTime) {
    await setLastPulledAt('activityLogs', serverTime);
  }
}
