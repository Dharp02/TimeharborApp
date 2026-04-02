# Timeharbor Core — Profiles, Tickets & Work Sessions

This document covers the **minimum viable Timeharbor backend**: enough for a user to sign up, create tickets, and track time — offline or online — without data corruption.

**Scope**: 3 collections, 1 shared calculation engine (`@timeharbor/time-engine`), 1 sync contract.

**Data model**: Per-session documents (not per-event). One MongoDB document per work session (CLOCK_IN → CLOCK_OUT) with ticket segments and breaks embedded inside.

---

## Shared Calculation Module: `@timeharbor/time-engine`

A single TypeScript package with **zero dependencies**. Contains pure functions that compute time totals from raw session data. Used by both the Fastify backend and the Next.js frontend (including Capacitor iOS/Android builds).

```
timeharbor-timehuddle-backend/
  packages/
    time-engine/                   ← @timeharbor/time-engine
      src/
        types.ts                   ← RawSession, SessionStats, DayStats interfaces
        computeSession.ts          ← pure function: session → stats
        computeDay.ts              ← pure function: sessions[] → day totals
        index.ts                   ← barrel export
      package.json
      tsconfig.json

  apps/
    api/                           ← backend: import { computeSession } from '@timeharbor/time-engine'

timeharbourapp/                    ← frontend: import { computeSession } from '@timeharbor/time-engine'
```

**Why a shared module?**
- Same input + same algorithm = same numbers. Always. Client and server can never disagree.
- The client computes everything offline using this module. The server re-verifies on push using the same function.
- Ships inside the Next.js bundle → available in Capacitor (iOS/Android) with no extra setup.

**Rules for this module:**
1. Zero dependencies (no `date-fns`, no `luxon`, no `mongodb`)
2. All timestamps are UTC epoch milliseconds (`number`)
3. All functions are pure: input → output, no side effects, no `Date.now()`
4. `referenceTime` is always passed in (for open sessions), never read from the system clock

---

## Collections

### 1. `profiles`

One Timeharbor profile per user. Auto-created on first login.

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | |
| `userId` | string | → `users._id` (Better Auth) |
| `app` | `"timeharbor"` | Always this value for now |
| `displayName` | string | |
| `status` | `"online"` \| `"offline"` | |
| `lastSeenAt` | Date? | |
| `githubUrl` | string? | |
| `linkedinUrl` | string? | |
| `redmineUrl` | string? | |
| `fcmToken` | string? | Push notification token |
| `fcmPlatform` | `"ios"` \| `"android"`? | |
| `fcmUpdatedAt` | Date? | |
| `createdAt` | Date | |
| `updatedAt` | Date | |

**Indexes**: `{ userId: 1, app: 1 }` (unique)

**API Endpoints**:

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/timeharbor/me/profile` | Get profile (auto-create if first visit) |
| PUT | `/api/timeharbor/me/profile` | Update display name, social links |
| POST | `/api/timeharbor/me/register-device` | Register FCM token |

---

### 2. `tickets`

Personal tickets only (no team context for now). Each ticket is something a user tracks time against.

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | |
| `title` | string | Required |
| `description` | string? | |
| `status` | `"Open"` \| `"In Progress"` \| `"Closed"` | Default: `"Open"` |
| `priority` | `"Low"` \| `"Medium"` \| `"High"` | Default: `"Medium"` |
| `link` | string? | External reference URL |
| `projectId` | string? | Future — project grouping |
| `createdBy` | string | userId |
| `source` | `"timeharbor"` | Always this value for now |
| `fieldTimestamps` | `{ [field]: Date }` | Per-field update timestamps for merge |
| `_conflicts` | array | Archived losing versions (zero data loss) |
| `_deleted` | boolean | Soft-delete for sync |
| `_rev` | number | Revision counter |
| `createdAt` | Date | |
| `updatedAt` | Date | |

**Indexes**: `{ createdBy: 1, _deleted: 1 }`, `{ status: 1 }`, `{ createdBy: 1, status: 1 }`

**API Endpoints**:

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/timeharbor/me/tickets` | Create personal ticket |
| GET | `/api/timeharbor/me/tickets` | List personal tickets |
| PUT | `/api/timeharbor/me/tickets/:ticketId` | Update ticket |
| DELETE | `/api/timeharbor/me/tickets/:ticketId` | Soft-delete ticket |

**Sync**: Bi-directional. Client creates tickets in Dexie (`_dirty: 1`), pushes to server. Server merges via `fieldTimestamps`. Client pulls updated records.

---

### 3. `workSessions` — Per-Session Documents

**One document per work session** (CLOCK_IN → CLOCK_OUT). Ticket segments and breaks are embedded arrays inside the session. This is MongoDB-native — rich, self-contained documents instead of many tiny rows.

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | |
| `clientSessionId` | string | **Client-generated UUID** — dedup key |
| `userId` | string | |
| `date` | string | `YYYY-MM-DD` — for querying all sessions in a day |
| `clockIn` | number | UTC epoch ms — when session started |
| `clockOut` | number \| null | null = session still open |
| `ticketSegments` | array | Embedded — see below |
| `breaks` | array | Embedded — see below |
| `totalSessionMs` | number | Pre-computed: clockOut - clockIn |
| `totalBreakMs` | number | Pre-computed: sum of all breaks |
| `netWorkMs` | number | Pre-computed: totalSessionMs - totalBreakMs |
| `ticketBreakdown` | array | Pre-computed: `[{ ticketId, ticketTitle, totalMs }]` |
| `comment` | string? | Note added on clock-out |
| `autoClosedAt` | number? | Set by background job if orphaned |
| `sourceApp` | `"timeharbor"` | Always this value for now |
| `_dirty` | 0 \| 1 | 1 = needs push to server |
| `_rev` | number | Revision counter |
| `createdAt` | number | epoch ms |
| `updatedAt` | number | epoch ms |

**Embedded: `ticketSegments[]`**:

| Field | Type | Notes |
|-------|------|-------|
| `segmentId` | string | UUID per segment |
| `ticketId` | string | → `tickets._id` |
| `ticketTitle` | string | Denormalized for offline display |
| `start` | number | epoch ms |
| `end` | number \| null | null = currently active |

**Embedded: `breaks[]`**:

| Field | Type | Notes |
|-------|------|-------|
| `breakId` | string | UUID per break |
| `start` | number | epoch ms |
| `end` | number \| null | null = currently on break |

**Indexes**: `{ clientSessionId: 1 }` (unique), `{ userId: 1, date: 1 }`, `{ userId: 1, clockIn: -1 }`, `{ userId: 1, clockOut: 1 }` (sparse — for finding open sessions)

**API Endpoints**:

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/timeharbor/time/sync-sessions` | Push sessions (dedup by `clientSessionId`) |
| GET | `/api/timeharbor/time/sessions` | Pull sessions since `lastPulledAt` |

**Example document** — a complete morning session:

```json
{
  "_id": "ObjectId(...)",
  "clientSessionId": "sess-aaa-001",
  "userId": "u1",
  "date": "2026-03-20",
  "clockIn": 1742457600000,
  "clockOut": 1742470200000,
  "ticketSegments": [
    {
      "segmentId": "seg-001",
      "ticketId": "T1",
      "ticketTitle": "Fix login bug",
      "start": 1742457900000,
      "end": 1742463000000
    },
    {
      "segmentId": "seg-002",
      "ticketId": "T2",
      "ticketTitle": "Review PR",
      "start": 1742463060000,
      "end": 1742468400000
    }
  ],
  "breaks": [
    {
      "breakId": "brk-001",
      "start": 1742464800000,
      "end": 1742465700000
    }
  ],
  "totalSessionMs": 12600000,
  "totalBreakMs": 900000,
  "netWorkMs": 11700000,
  "ticketBreakdown": [
    { "ticketId": "T1", "ticketTitle": "Fix login bug", "totalMs": 5100000 },
    { "ticketId": "T2", "ticketTitle": "Review PR", "totalMs": 4440000 }
  ],
  "sourceApp": "timeharbor",
  "_dirty": 0,
  "_rev": 8,
  "createdAt": 1742457600000,
  "updatedAt": 1742470200000
}
```

**Sync**: The session document is owned by a single device. On push, the server deduplicates by `clientSessionId` — if new, insert; if exists, take the version with a higher `_rev`. Pre-computed totals are re-verified by the server using `@timeharbor/time-engine`.

---

## How Mutations Update the Session Document

Instead of inserting separate event documents, each user action **updates the current session document** in Dexie, then recomputes totals using the shared `computeSession()` function:

| User Action | What Changes on the Document |
|-------------|------------------------------|
| **Clock in** | Create new session doc: `{ clockIn, ticketSegments: [], breaks: [] }` |
| **Start ticket** | `$push` to `ticketSegments`: `{ segmentId, ticketId, ticketTitle, start, end: null }` |
| **Stop ticket** | Set `end` on the segment where `end === null` |
| **Switch ticket** | Close current segment (`end = now`), push new segment |
| **Start break** | If ticket active: close its segment + remember `preBreakTicketId`. Push to `breaks`: `{ breakId, start, end: null }` |
| **End break** | Set `end` on the break where `end === null`. If `preBreakTicketId`: push new segment to resume that ticket |
| **Clock out** | Close everything: set `clockOut`, close open segment, close open break |

After each mutation: `computeSession(session, Date.now())` → store updated totals on the document.

---

## The Three Data Layers

```
Layer 1: RAW DATA (owned by client, stored on session doc)
  clockIn, clockOut, ticketSegments[], breaks[]
  Created in Dexie. Pushed to MongoDB. The user's actions produce this.

Layer 2: DERIVED STATS (computed by @timeharbor/time-engine)
  totalSessionMs, totalBreakMs, netWorkMs, ticketBreakdown
  Computed by computeSession() on BOTH client and server.
  Stored as cache on the document for fast reads.
  Can ALWAYS be recomputed from Layer 1.

Layer 3: DAILY AGGREGATES (server-side cache)
  userDailyStats collection
  Server sums Layer 2 across all sessions for a date.
  Client can also compute this locally from Dexie sessions.
```

---

## Calculation Engine (`@timeharbor/time-engine`)

### Types

```typescript
/** Raw session data — the input to computeSession() */
export interface RawSession {
  clockIn: number;                // epoch ms
  clockOut: number | null;        // null = still open
  ticketSegments: {
    segmentId: string;
    ticketId: string;
    ticketTitle: string;
    start: number;                // epoch ms
    end: number | null;           // null = currently active
  }[];
  breaks: {
    breakId: string;
    start: number;                // epoch ms
    end: number | null;           // null = currently on break
  }[];
}

/** Computed stats for a single session */
export interface SessionStats {
  totalSessionMs: number;         // Wall clock: clockOut - clockIn
  totalBreakMs: number;           // Sum of all break durations
  netWorkMs: number;              // totalSessionMs - totalBreakMs
  ticketBreakdown: {
    ticketId: string;
    ticketTitle: string;
    totalMs: number;              // Segment time minus break overlap
  }[];
  untrackedMs: number;            // netWorkMs - sum(ticketBreakdown)
  isOpen: boolean;                // clockOut === null
  isOnBreak: boolean;             // last break has end === null
  activeTicketId: string | null;  // segment with end === null
}

/** Aggregated stats for an entire day */
export interface DayStats {
  date: string;                   // YYYY-MM-DD
  totalSessionMs: number;
  totalBreakMs: number;
  netWorkMs: number;
  ticketBreakdown: {
    ticketId: string;
    ticketTitle: string;
    totalMs: number;
  }[];
  untrackedMs: number;
  sessionCount: number;
  hasOpenSession: boolean;
}
```

### `computeSession(session, referenceTime) → SessionStats`

```typescript
export function computeSession(session: RawSession, referenceTime: number): SessionStats {
  const clockOut = session.clockOut ?? referenceTime;
  const totalSessionMs = clockOut - session.clockIn;

  // Sum break time
  const totalBreakMs = session.breaks.reduce((sum, b) => {
    const bEnd = b.end ?? referenceTime;
    return sum + (bEnd - b.start);
  }, 0);

  // Per-ticket time (segment duration minus overlapping break time)
  const ticketBreakdown = session.ticketSegments.map(seg => {
    const segEnd = seg.end ?? referenceTime;
    const segDuration = segEnd - seg.start;

    // Subtract break time that overlaps this segment
    const breakOverlap = session.breaks.reduce((sum, b) => {
      const bStart = b.start;
      const bEnd = b.end ?? referenceTime;
      const overlapStart = Math.max(seg.start, bStart);
      const overlapEnd = Math.min(segEnd, bEnd);
      return sum + Math.max(0, overlapEnd - overlapStart);
    }, 0);

    return {
      ticketId: seg.ticketId,
      ticketTitle: seg.ticketTitle,
      totalMs: segDuration - breakOverlap,
    };
  });

  // Merge segments for the same ticket
  const merged = new Map<string, { ticketId: string; ticketTitle: string; totalMs: number }>();
  for (const t of ticketBreakdown) {
    const existing = merged.get(t.ticketId);
    if (existing) {
      existing.totalMs += t.totalMs;
    } else {
      merged.set(t.ticketId, { ...t });
    }
  }
  const mergedBreakdown = Array.from(merged.values());

  const ticketTotal = mergedBreakdown.reduce((s, t) => s + t.totalMs, 0);
  const netWorkMs = totalSessionMs - totalBreakMs;
  const untrackedMs = netWorkMs - ticketTotal;

  const lastBreak = session.breaks[session.breaks.length - 1];
  const activeSegment = session.ticketSegments.find(s => s.end === null);

  return {
    totalSessionMs,
    totalBreakMs,
    netWorkMs,
    ticketBreakdown: mergedBreakdown,
    untrackedMs,
    isOpen: session.clockOut === null,
    isOnBreak: lastBreak ? lastBreak.end === null : false,
    activeTicketId: activeSegment?.ticketId ?? null,
  };
}
```

### `computeDay(sessions, referenceTime) → DayStats`

```typescript
export function computeDay(
  sessions: RawSession[],
  date: string,
  referenceTime: number
): DayStats {
  const results = sessions.map(s => computeSession(s, referenceTime));

  // Merge ticket breakdowns across sessions
  const merged = new Map<string, { ticketId: string; ticketTitle: string; totalMs: number }>();
  for (const r of results) {
    for (const t of r.ticketBreakdown) {
      const existing = merged.get(t.ticketId);
      if (existing) {
        existing.totalMs += t.totalMs;
      } else {
        merged.set(t.ticketId, { ...t });
      }
    }
  }

  const totalSessionMs = results.reduce((s, r) => s + r.totalSessionMs, 0);
  const totalBreakMs = results.reduce((s, r) => s + r.totalBreakMs, 0);
  const netWorkMs = totalSessionMs - totalBreakMs;
  const ticketBreakdown = Array.from(merged.values());
  const ticketTotal = ticketBreakdown.reduce((s, t) => s + t.totalMs, 0);

  return {
    date,
    totalSessionMs,
    totalBreakMs,
    netWorkMs,
    ticketBreakdown,
    untrackedMs: netWorkMs - ticketTotal,
    sessionCount: sessions.length,
    hasOpenSession: results.some(r => r.isOpen),
  };
}
```

### Step-by-step Walkthrough

Given this session on 2026-03-20:

```json
{
  "clockIn":  "09:00",
  "clockOut": "12:30",
  "ticketSegments": [
    { "ticketId": "T1", "start": "09:05", "end": "10:30" },
    { "ticketId": "T2", "start": "10:31", "end": "12:00" }
  ],
  "breaks": [
    { "start": "11:00", "end": "11:15" }
  ]
}
```

**`computeSession()` output**:

```
totalSessionMs = 12:30 - 09:00 = 210 min
totalBreakMs   = 11:15 - 11:00 = 15 min
netWorkMs      = 210 - 15 = 195 min

T1: 10:30 - 09:05 = 85 min
    break overlap with T1: none (break is 11:00-11:15, T1 ends 10:30)
    T1 total = 85 min

T2: 12:00 - 10:31 = 89 min
    break overlap with T2: min(12:00, 11:15) - max(10:31, 11:00) = 11:15 - 11:00 = 15 min
    T2 total = 89 - 15 = 74 min

untrackedMs = 195 - (85 + 74) = 36 min
```

Those 36 untracked minutes are 09:00→09:05 (5 min) + 12:00→12:30 (30 min) + rounding from 10:30→10:31 (1 min). Exactly right.

---

## Offline ↔ Online Strategy

### Offline (Dexie is truth — this is the PRIMARY mode)

```
USER TAPS "CLOCK IN"
  │
  ▼
1. Create session document in Dexie
   { clientSessionId: uuid(), clockIn: Date.now(), _dirty: 1, ... }
  │
  ▼
2. computeSession(session, Date.now())  ← @timeharbor/time-engine
   → Store computed totals ON the session doc in Dexie
  │
  ▼
3. UI reads from Dexie (useLiveQuery)
   → Dashboard shows live numbers
   → For open sessions, tick referenceTime every 1s for display

... user works all day, starts tickets, takes breaks, clocks out
... every action updates the SAME session document + recomputes
... backend does not exist in this flow
... everything works
```

### Online — PUSH (device goes online)

```
SyncEngine wakes up (network detected or pull-to-refresh)
  │
  ▼
1. Query Dexie: sessions where _dirty === 1
  │
  ▼
2. POST /api/timeharbor/time/sync-sessions
   Send FULL session documents (raw data + pre-computed totals)
  │
  ▼
3. Server receives each session:
   │
   ├── clientSessionId NOT in MongoDB?
   │     → INSERT the document as-is
   │     → Re-verify: computeSession(rawData, clockOut ?? serverNow)
   │     → If totals match client → store as-is
   │     → If totals DON'T match → store SERVER's computation
   │        (client had old @timeharbor/time-engine version)
   │     → Upsert userDailyStats for the affected date
   │
   └── clientSessionId ALREADY exists?  (retry or multi-device)
         → Compare _rev: take higher revision
         → Re-verify totals with computeSession()
         → Upsert userDailyStats
  │
  ▼
4. Response: { accepted: [...], serverTime }
  │
  ▼
5. Client: set _dirty = 0 on pushed sessions
```

### Online — PULL (get sessions from other devices)

```
After push completes:
  │
  ▼
1. GET /api/timeharbor/time/sessions?since=lastPulledAt
  │
  ▼
2. Server returns sessions modified since that timestamp
  │
  ▼
3. Client upserts into Dexie by clientSessionId
   → If local session has _dirty: 1 → SKIP (local changes win until pushed)
   → If session is new to this device → INSERT
   → If server _rev > local _rev → UPDATE
  │
  ▼
4. UI auto-updates via useLiveQuery
5. Update lastPulledAt in syncMeta
```

### Why the Server Never Conflicts with Offline

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  A session is inherently single-device.                         │
│                                                                 │
│  You clock in on your PHONE → creates session "sess-phone-001" │
│  You clock in on your LAPTOP → creates session "sess-lap-001"  │
│                                                                 │
│  These are DIFFERENT DOCUMENTS. No conflict. Ever.              │
│                                                                 │
│  The server NEVER overwrites raw data (clockIn, segments,       │
│  breaks). The client owns those. The server ONLY re-verifies    │
│  the derived numbers using the same shared function.            │
│                                                                 │
│  If both sides use computeSession() from @timeharbor/time-      │
│  engine → numbers are identical. The "recompute on server"      │
│  is a VERIFICATION step, not a source of conflict.              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Why It Can't Corrupt

| Threat | Protection |
|--------|-----------|
| **Duplicate push** (retry, flaky network) | `clientSessionId` unique index — server upserts by `_rev` |
| **Two devices, both offline** | Each creates a separate session doc — different `clientSessionId`. On sync, both insert. Day totals sum both sessions |
| **Orphaned session** (forgot to clock out) | Background job sets `clockOut` on sessions open > 12h. This mutates the doc + recomputes. Syncs to client on pull |
| **App version mismatch** (different `computeSession`) | Server re-verifies totals from raw data using latest engine. Client updates → pulls → recalculates with updated engine |
| **Client sends tampered totals** | Server ignores client totals, recomputes from raw data |
| **Floating-point drift** | All values are integer milliseconds. No floats. No drift |
| **Timezone differences** | Everything is UTC epoch ms. No timezone math in computation |

### Multi-Device: How Day Totals Work

```
Phone (session "sess-phone-001"):
  Clock in 09:00, work on T1, clock out 12:30
  → computeSession() → 3h 30m session, T1: 3h 25m

Laptop (session "sess-laptop-001"):
  Clock in 14:00, work on T2, clock out 17:00
  → computeSession() → 3h session, T2: 3h

Both sync. Client queries day:
  Dexie: find({ userId, date: "2026-03-20" }) → 2 session docs

  computeDay([sess-phone, sess-laptop], "2026-03-20", now)
  → totalSessionMs: 6h 30m
  → T1: 3h 25m, T2: 3h
  → untrackedMs: 5m

No merge needed. No recalculation surprise. Each session is its own document.
```

---

## Dexie Schema (Client-Side)

```typescript
db.version(10).stores({
  // Profile
  profile: 'key, app',

  // Tickets (with sync metadata)
  tickets: 'id, _serverId, createdBy, status, _dirty, _deleted, _rev, updatedAt',

  // Work sessions (per-session documents)
  workSessions: 'id, clientSessionId, userId, date, clockIn, clockOut, _dirty, _rev, updatedAt',

  // Sync cursor tracking
  syncMeta: 'collection',
});
```

### Dexie Record Shape — Work Sessions

```typescript
interface DexieWorkSession {
  id: string;                     // Local Dexie auto-key
  clientSessionId: string;        // UUID — the dedup key
  _serverId?: string;             // MongoDB _id (null until first sync)
  _dirty: 0 | 1;                 // 1 = needs push
  _rev: number;                   // Bumped on each update

  userId: string;
  date: string;                   // YYYY-MM-DD
  clockIn: number;                // epoch ms
  clockOut: number | null;        // null = session still open
  ticketSegments: {
    segmentId: string;
    ticketId: string;
    ticketTitle: string;
    start: number;
    end: number | null;
  }[];
  breaks: {
    breakId: string;
    start: number;
    end: number | null;
  }[];

  // Pre-computed by computeSession() — stored for fast reads
  totalSessionMs: number;
  totalBreakMs: number;
  netWorkMs: number;
  ticketBreakdown: { ticketId: string; ticketTitle: string; totalMs: number }[];

  comment?: string;
  autoClosedAt?: number;
  sourceApp: 'timeharbor';
  createdAt: number;
  updatedAt: number;
}
```

---

## Server-Side: `userDailyStats`

Pre-computed daily aggregates. Server computes from `workSessions` using `computeDay()`.

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | |
| `userId` | string | |
| `date` | string | `YYYY-MM-DD` |
| `totalSessionMs` | number | |
| `totalBreakMs` | number | |
| `netWorkMs` | number | |
| `ticketBreakdown` | array | `[{ ticketId, ticketTitle, totalMs }]` |
| `sessionCount` | number | |

**Indexes**: `{ userId: 1, date: 1 }` (unique)

**When recomputed**: Every time `/time/sync-sessions` receives sessions — the server loads all sessions for the affected dates, runs `computeDay()`, and upserts.

---

## Sync Contract

### Push Sessions: `POST /api/timeharbor/time/sync-sessions`

**Request**:
```json
{
  "sessions": [
    {
      "clientSessionId": "sess-aaa-001",
      "date": "2026-03-20",
      "clockIn": 1742457600000,
      "clockOut": 1742470200000,
      "ticketSegments": [
        { "segmentId": "seg-001", "ticketId": "T1", "ticketTitle": "Fix bug", "start": 1742457900000, "end": 1742463000000 }
      ],
      "breaks": [
        { "breakId": "brk-001", "start": 1742464800000, "end": 1742465700000 }
      ],
      "totalSessionMs": 12600000,
      "totalBreakMs": 900000,
      "netWorkMs": 11700000,
      "ticketBreakdown": [{ "ticketId": "T1", "ticketTitle": "Fix bug", "totalMs": 5100000 }],
      "_rev": 8
    }
  ]
}
```

**Server logic**:
1. For each session: check `clientSessionId` in MongoDB
2. If new → `insertOne`. If exists, compare `_rev` → take higher
3. Re-verify: `computeSession(rawData)` — store server's computed totals
4. Collect affected dates → `computeDay()` → upsert `userDailyStats`
5. Return `{ accepted: number, affectedDates: string[] }`

### Pull Sessions: `GET /api/timeharbor/time/sessions`

**Query params**: `?since=2026-03-20T00:00:00.000Z`

**Returns**: Sessions where `updatedAt > since`, plus `serverTime` for sync cursor.

### Push/Pull Tickets: (unchanged from before)

Tickets use field-level merge via `fieldTimestamps`. Sessions use `_rev` comparison (single-device ownership makes field-level merge unnecessary).

---

## Background Job: Auto-Close Orphaned Sessions

| Setting | Value |
|---------|-------|
| Runs | Every hour (cron) |
| Finds | `workSessions` where `clockOut === null` and `clockIn` is > 12 hours ago |
| Action | Set `clockOut = clockIn + 12h`, `autoClosedAt = now`, run `computeSession()` to update totals, bump `_rev` |
| Recompute | `computeDay()` for affected date → upsert `userDailyStats` |

This mutates the session document directly. On next pull, the client receives the closed session and updates Dexie.

---

## How `@timeharbor/time-engine` Ships to Capacitor

The package is a workspace dependency of `timeharbourapp`. When Next.js builds (for web or Capacitor static export), it bundles the package into the JS bundle — same as any other imported module. No special Capacitor config needed.

```
npm run prod:ios
  │
  ├── CAPACITOR_BUILD=true next build
  │     → Webpack/Turbopack resolves @timeharbor/time-engine
  │     → Tree-shakes, bundles computeSession + computeDay into the JS output
  │     → Output: timeharbourapp/out/ (static HTML + JS)
  │
  ├── npx cap sync ios
  │     → Copies out/ → ios/App/App/public/
  │     → computeSession/computeDay are inside the bundled JS
  │
  └── npx cap open ios
        → Opens Xcode. The WKWebView loads the bundled JS.
        → @timeharbor/time-engine runs in the WebView like any other JS.
        → Works offline because it's bundled, not fetched from a server.
```

**The same flow applies to Android** (`prod:android` uses Capacitor's Android WebView).

**Key point**: `@timeharbor/time-engine` has **zero dependencies** and uses only basic JS (no Node.js APIs, no `fs`, no `process`). It runs anywhere JavaScript runs — browser, WebView, Node.js, Deno, Bun.

---

## Execution Order

```
Step 1 ─→ Create @timeharbor/time-engine package
           packages/time-engine/ with types, computeSession, computeDay
           Zero dependencies. Pure TypeScript.
           Wire into backend (workspace dependency)
           Wire into frontend (npm link or path dependency)
           Verify: npm run build works for both apps

Step 2 ─→ MongoDB setup
           Create profiles, tickets, workSessions, userDailyStats collections
           Create all indexes
           Verify in MongoDB Compass

Step 3 ─→ TypeScript interfaces (backend)
           Model files for Profile, Ticket, WorkSession, UserDailyStat
           Collection accessor module (getCollection pattern)

Step 4 ─→ API endpoints
           Profile: GET/PUT /me/profile, POST /register-device
           Tickets: CRUD /me/tickets
           Time: POST /time/sync-sessions, GET /time/sessions
           Sync: POST /sync/push (tickets), POST /sync/pull (tickets)
           Server uses computeSession() to verify totals on push

Step 5 ─→ Dexie schema upgrade
           workSessions table with clientSessionId index
           Tickets table with sync metadata

Step 6 ─→ Frontend session management
           Create/update session docs in Dexie on each user action
           Call computeSession() after every mutation
           Wire to useLiveQuery() for reactive dashboard
           Live counter: tick referenceTime every 1s for open sessions

Step 7 ─→ SyncEngine
           Push dirty sessions → /time/sync-sessions
           Push dirty tickets → /sync/push
           Pull updated tickets → /sync/pull
           Pull sessions → /time/sessions
           Update lastPulledAt

Step 8 ─→ Auto-close background job
           Cron: find open sessions > 12h, set clockOut, recompute
           Upsert userDailyStats
```

---

## Summary

| Concept | Approach |
|---------|----------|
| Data model | **Per-session documents**, not per-event rows |
| Documents per day | 2–4 (one per work session) — not 8–50 tiny events |
| Calculation | `@timeharbor/time-engine` — shared package, both sides |
| Offline mode | Dexie is primary store. `computeSession()` runs locally. No server needed |
| Online push | Client pushes full session docs. Server re-verifies totals with same function |
| Conflict risk | None — sessions are single-device documents. Different devices = different docs |
| Pre-computed totals | Stored on session doc for fast reads. Always recomputable from raw data |
| Break handling | Embedded in session. Break overlap subtracted from ticket segment time |
| Open sessions | `clockOut: null`. `computeSession(session, Date.now())` uses referenceTime |
| Multi-device | Each device creates separate sessions. Day totals sum all sessions |
| Capacitor (iOS/Android) | `@timeharbor/time-engine` bundled into Next.js static export. No extra config |
| Server verification | Server recomputes from raw data — never trusts client totals blindly |
| Dashboard stats | Client: `computeDay()` on Dexie sessions. Server: `userDailyStats` cache |
| Orphaned sessions | Background job closes after 12h, recomputes, syncs on next pull |
