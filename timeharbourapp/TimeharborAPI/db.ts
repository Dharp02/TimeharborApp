import Dexie, { type Table } from 'dexie';
import type { TicketSegment, Break, TicketTime } from '@timeharbor/time-engine';
import type { OpLogEntry, StoredKeyRecord, FieldHLCMap } from './sync/types';

export interface UserProfile {
  key: string;
  data: any;
}

export interface Ticket {
  id: string;
  title: string;
  description?: string;
  status: 'Open' | 'In Progress' | 'Closed' | 'Done';
  priority: 'Low' | 'Medium' | 'High';
  link?: string;
  teamId: string;
  createdBy: string;
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
  source?: 'personal' | 'timehuddle';
  syncedWithTimehuddle?: boolean;
  sharedToTimehuddle?: boolean;
  pulseVideo?: {
    url: string;
    recordedAt: string;
    duration: string;
  };
  trackedTime?: string;
  trackedMs?: number;
  /** Milliseconds already pushed to TimeHuddle backend. Used to compute pending delta. */
  _pushedMs?: number;
  teamName?: string;
  projectId?: string;
  projectName?: string;
  creator?: {
    id: string;
    full_name: string;
    email: string;
  };
  assignee?: {
    id: string;
    full_name: string;
    email: string;
  };
  _deleted?: boolean;
}

export interface SessionAttachment {
  name: string;
  type: string; // MIME type
  dataUrl: string; // base64 data URL
}

export interface DexieWorkSession {
  id: string;
  clientSessionId: string;
  userId: string;
  date: string; // YYYY-MM-DD
  clockIn: number; // epoch ms
  clockOut: number | null;
  ticketSegments: TicketSegment[];
  breaks: Break[];
  totalSessionMs: number;
  totalBreakMs: number;
  netWorkMs: number;
  ticketBreakdown: TicketTime[];
  comment?: string;
  links?: string[];
  attachments?: SessionAttachment[];
  autoClosedAt?: number;
  /** Manual overrides set when editing an entry in the timesheet */
  flag?: string;
  manualTicket?: string;
  manualStatus?: 'Active' | 'Completed' | 'Pending';
  sourceApp: 'timeharbor';
  createdAt: number;
  updatedAt: number;
}

export interface SyncMeta {
  collection: string;
  lastPulledAt: string; // ISO
}

export interface DexieNote {
  id: string;
  userId: string;
  title: string;
  content: string; // JSON string (BlockNote document)
  _deleted: boolean;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

export interface DexieActivityLog {
  id: string;          // client-generated ID (also used as clientId for server dedup)
  userId?: string;
  teamId?: string;
  type: string;
  title: string;
  subtitle?: string;
  description?: string;
  link?: string;
  startTime: string;
  endTime?: string;
  status?: 'Active' | 'Completed' | 'Pending' | 'Failed';
  duration?: string;
  durationMs?: number;
  metadata?: Record<string, any>;
}

export type ProjectStatus = 'Active' | 'On Hold' | 'Completed' | 'Archived';
export type ProjectColor =
  | 'blue' | 'green' | 'purple' | 'orange' | 'red'
  | 'teal' | 'pink' | 'yellow' | 'indigo' | 'gray';

export interface DexieOperationLog {
  id: string;
  userId: string;
  category: string;
  action: string;
  result: 'success' | 'failure';
  target?: string;
  targetId?: string;
  details?: Record<string, unknown>;
  errorMessage?: string;
  timestamp: string; // ISO
}

export interface DexieProject {
  id: string;
  _deleted: boolean;
  name: string;
  description?: string;
  status: ProjectStatus;
  color: ProjectColor;
  prefix: string;
  repoUrl?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface DexieUserProfile {
  id: string; // same as userId — one profile per user
  userId: string;
  displayName?: string;
  email?: string;
  avatarBase64?: string | null;
  githubUrl?: string;
  linkedinUrl?: string;
  redmineUrl?: string;
  _deleted?: boolean;
  _fieldHLC?: Record<string, string>;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

/** Tracks which op-log entry IDs have been applied from remote devices. */
export interface AppliedOp {
  /** The op-log entry id that was already applied. */
  id: string;
  /** When it was applied locally (ISO). */
  appliedAt: string;
}

export class TimeharborDB extends Dexie {
  profile!: Table<UserProfile>;
  tickets!: Table<Ticket>;
  projects!: Table<DexieProject>;
  activityLogs!: Table<DexieActivityLog>;
  workSessions!: Table<DexieWorkSession>;
  syncMeta!: Table<SyncMeta>;
  notes!: Table<DexieNote>;
  operationLogs!: Table<DexieOperationLog>;
  userProfiles!: Table<DexieUserProfile>;
  // ── Encrypted sync tables (v15) ──
  opLog!: Table<OpLogEntry>;
  deviceKeys!: Table<StoredKeyRecord>;
  appliedOps!: Table<AppliedOp>;
  cachedKeys!: Table<{ id: string; key: CryptoKey }>;

  constructor(dbName = 'TimeharborDB') {
    super(dbName);
    
    // Combined history from lib/db.ts and LocalTimeStore.ts
    this.version(1).stores({
      attendance: 'id, userId, clockIn, clockOut',
      workLogs: 'id, userId, ticketId, attendanceId, startTime, endTime',
      offlineMutations: '++id, timestamp'
    });
    
    this.version(2).stores({
      attendance: null,
      workLogs: 'id, userId, ticketId, startTime, endTime',
      profile: 'key',
      offlineMutations: '++id, timestamp'
    });

    this.version(3).stores({
      workLogs: null, // Drop old table
      events: 'id, userId, type, timestamp, synced'
    });

    this.version(4).stores({
      teams: 'id'
    });

    this.version(5).stores({
      tickets: 'id, teamId'
    });

    this.version(6).stores({
      dashboardStats: 'teamId', // teamId as key, or 'global' for all teams
      dashboardActivity: 'id, teamId'
    });

    this.version(7).stores({
      events: 'id, userId, type, timestamp, synced, teamId'
    });

    this.version(8).stores({
      activityLogs: 'id, teamId, startTime' // Add explicit table for activity logs
    });

    this.version(9).stores({
      projects: 'id, createdBy'
    });

    this.version(10).stores({
      workSessions: 'id, clientSessionId, userId, date, clockIn, clockOut, _dirty, _rev, updatedAt',
      syncMeta: 'collection'
    });

    this.version(11).stores({
      notes: 'id, userId, _serverId, _dirty, _rev, updatedAt',
      activityLogs: 'id, teamId, startTime, _dirty, _rev, userId'
    });

    this.version(12).stores({
      tickets: 'id, teamId, _dirty, _serverId'
    });

    this.version(13).stores({
      projects: 'id, createdBy, _dirty, _serverId'
    });

    this.version(14).stores({
      operationLogs: 'id, userId, category, action, result, _dirty, timestamp'
    });

    // ── Encrypted op-log sync tables ──
    this.version(15).stores({
      opLog: 'id, [userId+_synced], [userId+collection+entityId], hlc, timestamp',
      deviceKeys: 'id',
      appliedOps: 'id, appliedAt'
    });

    // ── Phase 5: Drop legacy sync indexes (_dirty, _serverId, _rev) ──
    this.version(16).stores({
      workSessions: 'id, clientSessionId, userId, date, clockIn, clockOut, updatedAt',
      notes: 'id, userId, updatedAt',
      activityLogs: 'id, teamId, startTime, userId',
      tickets: 'id, teamId',
      projects: 'id, createdBy',
      operationLogs: 'id, userId, category, action, result, timestamp',
      offlineMutations: null, // Drop legacy offline mutations table
    }).upgrade(async (tx) => {
      // Strip legacy sync fields from all existing records
      const tables = ['workSessions', 'notes', 'activityLogs', 'tickets', 'projects', 'operationLogs'] as const;
      for (const tableName of tables) {
        const table = tx.table(tableName);
        await table.toCollection().modify((record: Record<string, unknown>) => {
          delete record._dirty;
          delete record._serverId;
          delete record._rev;
        });
      }
    });

    // ── v17: Add _syncEnabled flag to opLog for selective sync ──
    this.version(17).stores({
      opLog: 'id, [userId+_synced+_syncEnabled], [userId+collection+entityId], hlc, timestamp',
    }).upgrade(async (tx) => {
      // Default all existing entries to _syncEnabled = 1
      await tx.table('opLog').toCollection().modify((entry: Record<string, unknown>) => {
        if (entry._syncEnabled === undefined) {
          entry._syncEnabled = 1;
        }
      });
    });

    // ── v18: Persistent sync key cache (skip passphrase on reload) ──
    this.version(18).stores({
      cachedKeys: 'id',
    });

    // ── v19: User profiles table (synced via op-log) ──
    this.version(19).stores({
      userProfiles: 'id, userId',
    });

    // ── v20: Drop unused tables ──
    this.version(20).stores({
      events: null,
      teams: null,
      dashboardStats: null,
      dashboardActivity: null
    });

    // ── v21: Add _disconnected index to tickets for TimeHuddle disconnection state ──
    // _disconnected: 0 = active, 1 = disconnected (read-only, team was unlinked)
    this.version(21).stores({
      tickets: 'id, teamId, [source+_disconnected]',
    }).upgrade(async (tx) => {
      await tx.table('tickets').toCollection().modify((t: Record<string, unknown>) => {
        if (t._disconnected === undefined) t._disconnected = 0;
      });
    });

    // ── v22: Track how much time has been pushed to TimeHuddle per ticket ──
    // _pushedMs: cumulative ms already pushed; pendingMs = trackedMs - _pushedMs
    this.version(22).stores({}).upgrade(async (tx) => {
      await tx.table('tickets').toCollection().modify((t: Record<string, unknown>) => {
        if (t._pushedMs === undefined) t._pushedMs = 0;
      });
    });
  }
}

const DEFAULT_DB_NAME = 'TimeharborDB';

let activeDb: TimeharborDB | null = null;
let activeDbName: string | null = null;

function getDatabaseNameForProfile(profileUuid?: string | null): string {
  const trimmedUuid = profileUuid?.trim();
  return trimmedUuid ? `${DEFAULT_DB_NAME}_${trimmedUuid}` : DEFAULT_DB_NAME;
}

function getInitialDatabaseName(): string {
  if (typeof window === 'undefined') return DEFAULT_DB_NAME;
  const currentUuid = localStorage.getItem('th_identity_uuid');
  return getDatabaseNameForProfile(currentUuid);
}

function ensureActiveDb(): TimeharborDB {
  if (typeof window === 'undefined') {
    throw new Error('Database is only available in the browser runtime.');
  }

  if (!activeDb) {
    activeDbName = getInitialDatabaseName();
    activeDb = new TimeharborDB(activeDbName);
  }

  return activeDb;
}

export function getCurrentDatabaseName(): string {
  return activeDbName ?? getInitialDatabaseName();
}

export async function hasProfileDatabase(profileUuid: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const dbName = getDatabaseNameForProfile(profileUuid);

  try {
    return await Dexie.exists(dbName);
  } catch (e) {
    console.warn('Dexie.exists check failed', e);
    // If we can't reliably check, allow the switch attempt
    return true; 
  }
}

// Listeners notified after every successful DB switch (including no-op same-name switches).
const dbSwitchListeners = new Set<() => void>();

export function subscribeToDbSwitch(listener: () => void): () => void {
  dbSwitchListeners.add(listener);
  return () => dbSwitchListeners.delete(listener);
}

/**
 * Switch active IndexedDB to a profile-scoped database.
 * Existing profile data is preserved; this only swaps which DB is active.
 */
export async function switchProfileDatabase(profileUuid: string): Promise<void> {
  if (typeof window === 'undefined') return;

  const nextDbName = getDatabaseNameForProfile(profileUuid);
  const current = ensureActiveDb();

  if (activeDbName === nextDbName) {
    if (!current.isOpen()) await current.open();
    dbSwitchListeners.forEach(fn => fn());
    return;
  }

  if (current.isOpen()) {
    current.close();
  }

  activeDb = new TimeharborDB(nextDbName);
  activeDbName = nextDbName;
  await activeDb.open();
  dbSwitchListeners.forEach(fn => fn());
}

const browserDbProxy = new Proxy({} as TimeharborDB, {
  get(_target, prop) {
    const instance = ensureActiveDb();
    const value = (instance as unknown as Record<PropertyKey, unknown>)[prop];
    if (typeof value === 'function') {
      return (value as Function).bind(instance);
    }
    return value;
  },
});

export const db = typeof window !== 'undefined' ? browserDbProxy : {} as TimeharborDB;

/**
 * Wipe the entire local database and re-open a fresh instance.
 * Call this on sign-out to prevent data leaking between users.
 */
export async function clearDatabase() {
  if (typeof window === 'undefined') return;
  const instance = ensureActiveDb();
  await instance.delete();
  activeDb = new TimeharborDB(getCurrentDatabaseName());
  await activeDb.open();
}
