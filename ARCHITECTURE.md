# Timeharbor + Timehuddle — Architecture & Execution Plan

## Overview

Two apps, one backend. **Timeharbor** is a personal time-tracking app (offline-first, Dexie.js as primary store). **Timehuddle** is a team collaboration platform (groups, ticket assignment, stories, presence). Both apps share a single **Fastify/MongoDB** backend and a single **Better Auth** identity — but each user gets a separate profile per app, linked via deeplink.

```
┌──────────────────────────────────────────────────┐
│           Timeharbor (Next.js + Capacitor)        │
│                                                   │
│   Dexie.js ←→ SyncEngine ←→ API Client           │
│   (primary      (queue +      (X-App-Id:          │
│    store)        merge)        timeharbor)         │
└────────────────────────┬─────────────────────────┘
                         │
┌────────────────────────┼─────────────────────────┐
│           Timehuddle (separate frontend)          │
│                                                   │
│   Own Store ←→ Own Sync ←→ API Client             │
│                               (X-App-Id:          │
│                                timehuddle)         │
└────────────────────────┬─────────────────────────┘
                         │
                    HTTP / WebSocket
                         │
┌────────────────────────▼─────────────────────────┐
│         Shared Fastify Backend (apps/api)         │
│                                                   │
│   /api/auth/*        → Better Auth (shared)       │
│   /api/timeharbor/*  → Timeharbor routes          │
│   /api/timehuddle/*  → Timehuddle routes          │
│   /api/bridge/*      → Cross-app linking & sync   │
│   WebSocket          → Presence + live updates    │
│                                                   │
│   ┌───────────────────────────────────────────┐   │
│   │            MongoDB Collections            │   │
│   │  16 collections (see table below)         │   │
│   └───────────────────────────────────────────┘   │
└───────────────────────────────────────────────────┘
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend framework | Fastify v5 |
| Database | MongoDB (native driver, no Mongoose) |
| Auth | Better Auth with MongoDB adapter |
| Frontend (Timeharbor) | Next.js 14+, React, TypeScript, Capacitor |
| Offline storage | Dexie.js (IndexedDB) |
| Real-time | @fastify/websocket |
| API docs | @fastify/swagger (auto-generated at `/docs`) |

### Key Principles

- **Offline-first**: Dexie.js is the primary data store in Timeharbor. All reads are local. Writes go to Dexie first, sync to server when online.
- **Zero data loss**: Conflicts resolved via field-level merge; losing versions archived in `_conflicts[]` array.
- **Opt-in cross-app**: Nothing flows between apps unless profiles are explicitly linked via deeplink.
- **Append-only time events**: Work logs are never edited — deduplication by client-generated UUID.

---

## MongoDB Collections

### Summary Table

| # | Collection | Purpose | Owner | Sync Direction |
|---|-----------|---------|-------|----------------|
| 1 | `users` | Auth identity (Better Auth managed) | Shared | — |
| 2 | `profiles` | Per-app profile (one per app per user) | Each app | Pull to client |
| 3 | `accountLinks` | Deeplink-based profile linking tokens | Bridge | Server-only |
| 4 | `teams` | Teams / groups | Timehuddle | TH→pull read-only |
| 5 | `members` | Team membership | Timehuddle | TH→pull read-only |
| 6 | `tickets` | Personal + team tickets (unified) | Both | Bi-directional (personal) / Pull (Timehuddle) |
| 7 | `workLogs` | Time events (append-only) | Both | Push-only |
| 8 | `workLogReplies` | Comments on work logs | Both | Bi-directional |
| 9 | `activityLogs` | Activity entries (append-only) | Both | Push-mostly |
| 10 | `notifications` | Alerts & push notifications | Server | Pull-only |
| 11 | `projects` | Project grouping for tickets | Timeharbor | Bi-directional |
| 12 | `userDailyStats` | Pre-computed daily time totals | Server | Pull-only |
| 13 | `pulseAttachments` | Video recordings + stories | Both | Pull-only |
| 14 | `presenceHeartbeats` | WebSocket presence tracking | Server | Real-time (ephemeral) |
| 15 | `syncMeta` | Per-user sync cursors | Client | Local tracking |
| 16 | `sharingPreferences` | Cross-app consent settings | Bridge | Pull from server |
| 17 | `bridgeEvents` | Cross-app audit trail | Bridge | Pull-only |

> **TH** = Timeharbor, **TD** = Timehuddle

### Collection Schemas

#### 1. `users` — Auth Identity (Better Auth)

Managed by Better Auth. Shared across both apps. No custom fields added here.

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | Primary key |
| `name` | string | Display name |
| `email` | string | Unique |
| `emailVerified` | boolean | |
| `image` | string? | Avatar URL |
| `createdAt` | Date | |
| `updatedAt` | Date | |

**Indexes**: `{ email: 1 }` (unique — from Better Auth)

---

#### 2. `profiles` — Per-App Profile

Each user gets **one profile per app** (max 2). Stores app-specific settings, social links, FCM tokens, and the cross-app link pointer.

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | |
| `userId` | string | → `users._id` |
| `app` | `"timeharbor"` \| `"timehuddle"` | Which app this profile belongs to |
| `displayName` | string? | App-specific display name |
| `status` | `"online"` \| `"offline"` | Presence indicator |
| `lastSeenAt` | Date? | |
| `githubUrl` | string? | Social link |
| `linkedinUrl` | string? | Social link |
| `redmineUrl` | string? | Social link |
| `fcmToken` | string? | Push notification token |
| `fcmPlatform` | `"ios"` \| `"android"`? | |
| `fcmUpdatedAt` | Date? | |
| `linkedProfileId` | string? | → the OTHER app's profile `_id` (null until linked) |
| `linkedAt` | Date? | When linking was completed |
| `createdAt` | Date | |
| `updatedAt` | Date | |

**Indexes**: `{ userId: 1, app: 1 }` (unique), `{ linkedProfileId: 1 }` (sparse), `{ status: 1, app: 1 }`

---

#### 3. `accountLinks` — Deeplink Linking Tokens

Tracks the deeplink-based flow for connecting Timeharbor ↔ Timehuddle profiles.

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | |
| `token` | string | Unique, short-lived token in the deeplink URL |
| `initiatorProfileId` | string | Timehuddle profile that generated the link |
| `targetUserId` | string? | Resolved when Timeharbor user opens the link |
| `targetProfileId` | string? | Filled when linking completes |
| `status` | `"pending"` \| `"completed"` \| `"expired"` \| `"revoked"` | |
| `expiresAt` | Date | Token TTL (24h default) |
| `completedAt` | Date? | |
| `createdAt` | Date | |

**Indexes**: `{ token: 1 }` (unique), `{ status: 1, expiresAt: 1 }`, `{ initiatorProfileId: 1 }`

---

#### 4. `teams` — Timehuddle-Owned Teams

Created and managed in Timehuddle. Reflected read-only in Timeharbor for linked users.

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | |
| `name` | string | |
| `code` | string | Unique join code |
| `inviteToken` | string? | For deeplink invite URLs |
| `createdBy` | string | Timehuddle profile ID |
| `createdAt` | Date | |
| `updatedAt` | Date | |

**Indexes**: `{ code: 1 }` (unique), `{ createdBy: 1 }`, `{ inviteToken: 1 }` (sparse unique)

---

#### 5. `members` — Team Membership

Managed by Timehuddle. Users join via invite link or are directly added.

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | |
| `userId` | string | Auth user ID |
| `profileId` | string | Timehuddle profile ID |
| `teamId` | string | → `teams._id` |
| `role` | `"Leader"` \| `"Member"` | |
| `joinedVia` | `"invite_link"` \| `"direct_add"` \| `"creator"` | How they joined |
| `joinedAt` | Date | |

**Indexes**: `{ userId: 1, teamId: 1 }` (unique), `{ teamId: 1 }`, `{ profileId: 1 }`

---

#### 6. `tickets` — Unified Tickets

Holds both personal (Timeharbor) and team (Timehuddle) tickets in one collection. The `source` field determines origin.

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | |
| `title` | string | |
| `description` | string? | |
| `status` | `"Open"` \| `"In Progress"` \| `"Closed"` | |
| `priority` | `"Low"` \| `"Medium"` \| `"High"` | |
| `link` | string? | External reference URL |
| `teamId` | string? | null = personal ticket |
| `projectId` | string? | → `projects._id` |
| `createdBy` | string | User ID |
| `assignedTo` | string? | User ID |
| `source` | `"timeharbor"` \| `"timehuddle"` | Which app created the ticket |
| `sharedWithTimehuddle` | boolean | Timeharbor user opted to share |
| `syncedWithTimehuddle` | boolean | Confirmed synced |
| `timehuddleTicketId` | string? | Cross-reference to Timehuddle |
| `timeharborTicketId` | string? | Reverse link when source is Timehuddle |
| `fieldTimestamps` | `{ [field]: Date }` | Per-field update timestamps (for merge) |
| `_conflicts` | array | Archived conflicting versions |
| `_deleted` | boolean | Soft delete for sync |
| `_rev` | number | Revision counter |
| `createdAt` | Date | |
| `updatedAt` | Date | |

**Indexes**: `{ teamId: 1, status: 1 }`, `{ createdBy: 1 }`, `{ assignedTo: 1 }`, `{ projectId: 1 }`, `{ _deleted: 1 }`, `{ source: 1 }`, `{ timehuddleTicketId: 1 }` (sparse)

---

#### 7. `workLogs` — Time Events (Append-Only)

Every clock-in, clock-out, ticket start/stop, and break is an immutable event. Deduplication by `clientEventId` (generated on the client).

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | |
| `clientEventId` | string | Client-generated UUID (dedup key) |
| `userId` | string | |
| `teamId` | string? | |
| `type` | `"CLOCK_IN"` \| `"CLOCK_OUT"` \| `"START_TICKET"` \| `"STOP_TICKET"` \| `"BREAK_START"` \| `"BREAK_END"` | |
| `timestamp` | Date | When the event occurred |
| `ticketId` | string? | |
| `ticketTitle` | string? | Denormalized for display |
| `comment` | string? | |
| `link` | string? | |
| `sourceApp` | `"timeharbor"` \| `"timehuddle"` | Which app generated the event |
| `bridged` | boolean | Was this event mirrored to the other app |
| `createdAt` | Date | |

**Indexes**: `{ clientEventId: 1 }` (unique), `{ userId: 1, timestamp: -1 }`, `{ userId: 1, type: 1, timestamp: -1 }`, `{ teamId: 1 }`, `{ ticketId: 1, bridged: 1 }`

---

#### 8. `workLogReplies`

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | |
| `workLogId` | string | → `workLogs._id` |
| `userId` | string | |
| `content` | string | |
| `createdAt` | Date | |
| `updatedAt` | Date | |

**Indexes**: `{ workLogId: 1 }`

---

#### 9. `activityLogs` — Append-Only

Frontend-generated activity entries. Deduplication by `activityId`.

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | |
| `activityId` | string | Unique, frontend-generated |
| `userId` | string | |
| `teamId` | string | |
| `type` | string | |
| `title` | string | |
| `subtitle` | string? | |
| `description` | string? | |
| `link` | string? | |
| `status` | string? | |
| `startTime` | Date | |
| `endTime` | Date? | |
| `duration` | string? | |
| `createdAt` | Date | |
| `updatedAt` | Date | |

**Indexes**: `{ activityId: 1 }` (unique), `{ teamId: 1, startTime: -1 }`, `{ userId: 1, teamId: 1 }`

---

#### 10. `notifications` — Server-Authoritative

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | |
| `userId` | string | |
| `title` | string | |
| `body` | string | |
| `type` | string | Default: `"info"` |
| `data` | object | Arbitrary payload |
| `readAt` | Date? | null = unread |
| `createdAt` | Date | |
| `updatedAt` | Date | |

**Indexes**: `{ userId: 1, createdAt: -1 }`, `{ userId: 1, readAt: 1 }`

---

#### 11. `projects`

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | |
| `name` | string | |
| `description` | string? | |
| `createdBy` | string | |
| `teamId` | string? | |
| `fieldTimestamps` | `{ [field]: Date }` | For conflict merge |
| `_conflicts` | array | Archived versions |
| `_deleted` | boolean | Soft delete |
| `_rev` | number | Revision counter |
| `createdAt` | Date | |
| `updatedAt` | Date | |

**Indexes**: `{ createdBy: 1 }`, `{ teamId: 1 }`

---

#### 12. `userDailyStats` — Pre-Computed Aggregates

Server computes these from workLogs. The dashboard reads from here (O(1) instead of replaying events).

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | |
| `userId` | string | |
| `teamId` | string? | |
| `date` | string | `YYYY-MM-DD` |
| `totalMs` | number | Milliseconds worked |

**Indexes**: `{ userId: 1, teamId: 1, date: 1 }` (unique), `{ userId: 1, date: 1 }`

---

#### 13. `pulseAttachments` — Video Recordings + Stories

Pulse video recordings attached to tickets. Also serves as the stories feed.

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | |
| `ticketId` | string | |
| `teamId` | string | |
| `requestedBy` | string? | |
| `draftId` | string | Unique — from Pulse Vault |
| `status` | `"pending"` \| `"uploaded"` \| `"failed"` \| `"expired"` | |
| `deeplink` | string? | Launch URL |
| `qrData` | string? | QR code data |
| `watchUrl` | string? | Playback URL |
| `thumbnailUrl` | string? | |
| `title` | string? | |
| `viewedBy` | string[] | Profile IDs who have viewed (stories read-receipts) |
| `expiresAt` | Date? | |
| `uploadedAt` | Date? | |
| `createdAt` | Date | |
| `updatedAt` | Date | |

**Indexes**: `{ draftId: 1 }` (unique), `{ ticketId: 1, teamId: 1 }`, `{ status: 1, expiresAt: 1 }`, `{ teamId: 1, status: 1, uploadedAt: -1 }`

---

#### 14. `presenceHeartbeats` — WebSocket Presence

Ephemeral. Auto-deleted by MongoDB TTL index when a client stops pinging.

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | |
| `userId` | string | |
| `profileId` | string | |
| `app` | `"timeharbor"` \| `"timehuddle"` | |
| `socketId` | string | |
| `status` | `"online"` \| `"idle"` \| `"offline"` | |
| `connectedAt` | Date | |
| `lastPingAt` | Date | |

**Indexes**: `{ userId: 1, app: 1 }`, `{ profileId: 1 }`, `{ lastPingAt: 1 }` (TTL: 120s)

---

#### 15. `syncMeta` — Sync Cursors

Tracks how far each user has synced per collection.

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | |
| `userId` | string | |
| `collection` | string | e.g. `"tickets"`, `"workLogs"` |
| `lastPulledAt` | Date | |
| `lastPushedAt` | Date | |

**Indexes**: `{ userId: 1, collection: 1 }` (unique)

---

#### 16. `sharingPreferences` — Cross-App Consent

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | |
| `userId` | string | |
| `shareWith` | `"timehuddle"` | Extensible for future apps |
| `sharedCollections` | string[] | e.g. `["tickets", "workLogs"]` |
| `autoSyncTimers` | boolean | Auto-bridge ticket timer events |
| `consentedAt` | Date | |
| `revokedAt` | Date? | |
| `createdAt` | Date | |
| `updatedAt` | Date | |

**Indexes**: `{ userId: 1, shareWith: 1 }` (unique)

---

#### 17. `bridgeEvents` — Cross-App Audit Trail

Every cross-app data flow is logged here. Nothing is implicit.

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | |
| `type` | `"ticket_shared"` \| `"ticket_assigned"` \| `"timer_synced"` \| `"ticket_status_changed"` \| `"sharing_revoked"` | |
| `sourceApp` | `"timeharbor"` \| `"timehuddle"` | |
| `targetApp` | `"timeharbor"` \| `"timehuddle"` | |
| `userId` | string | Who triggered the event |
| `targetUserId` | string? | Who was affected |
| `ticketId` | string? | |
| `workLogId` | string? | |
| `payload` | object | Snapshot of bridged data |
| `status` | `"pending"` \| `"delivered"` \| `"failed"` | |
| `createdAt` | Date | |

**Indexes**: `{ ticketId: 1 }`, `{ userId: 1, createdAt: -1 }`, `{ status: 1 }`, `{ type: 1, targetApp: 1 }`

---

## API Endpoints

### Auth (Better Auth — shared)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/auth/sign-up/email` | Register |
| POST | `/api/auth/sign-in/email` | Login |
| POST | `/api/auth/sign-out` | Logout |
| GET | `/api/auth/get-session` | Current session |
| POST | `/api/auth/request-password-reset` | Forgot password |
| POST | `/api/auth/reset-password` | Reset password |
| GET | `/api/auth/sign-in/social` | OAuth initiation |
| GET | `/api/auth/callback/:provider` | OAuth callback |

### Timeharbor Routes (`/api/timeharbor`)

#### Profile

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/me/profile` | Get Timeharbor profile (auto-create if first visit) |
| PUT | `/me/profile` | Update profile (name, social links) |
| POST | `/me/register-device` | Register FCM token |
| GET | `/me/linked-teams` | Get teams from linked Timehuddle (read-only) |

#### Tickets (personal only)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/me/tickets` | Create personal ticket |
| GET | `/me/tickets` | List personal tickets |
| GET | `/me/tickets/all` | Combined: personal + Timehuddle-assigned tickets |
| PUT | `/me/tickets/:ticketId` | Update personal ticket |
| DELETE | `/me/tickets/:ticketId` | Delete personal ticket |

> Timehuddle tickets are **read-only** in Timeharbor. Users can clock time on them but not edit metadata.

#### Time

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/time/sync-events` | Push time events (dedup by `clientEventId`) |
| GET | `/time/events` | Pull events since last sync |

#### Dashboard

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/dashboard/stats` | Time stats (pre-computed + live session) |
| GET | `/dashboard/activity` | Recent activity feed |
| POST | `/dashboard/activity/reply` | Reply to work log |
| GET | `/dashboard/member/:memberId` | Member activity |
| GET | `/dashboard/timesheet` | Daily hour totals |

#### Activity Logs

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/teams/:teamId/logs` | Get activity logs |
| POST | `/teams/:teamId/logs/sync` | Sync logs (upsert by `activityId`) |

#### Notifications

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/notifications` | Paginated list |
| PATCH | `/notifications/:id/read` | Mark as read |
| PATCH | `/notifications/read-all` | Mark all as read |
| DELETE | `/notifications/:id` | Delete one |
| DELETE | `/notifications` | Batch delete |

#### Projects

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/projects` | Create |
| GET | `/projects` | List |
| GET | `/projects/:id` | Get one |
| PUT | `/projects/:id` | Update |
| DELETE | `/projects/:id` | Delete |
| PUT | `/projects/:id/tickets/:ticketId` | Assign ticket to project |

#### Pulse

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/teams/:teamId/tickets/:ticketId/pulse` | Request recording |
| GET | `/teams/:teamId/tickets/:ticketId/pulse` | List recordings |
| GET | `/teams/:teamId/tickets/:ticketId/pulse/pending` | List pending |
| DELETE | `/teams/:teamId/tickets/:ticketId/pulse/:id` | Delete reference |

#### Stories

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/me/stories` | Stories feed from linked Timehuddle teams |
| POST | `/stories/:pulseId/view` | Mark story as viewed |

#### Sync Gateway

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/sync/push` | Push batch mutations for any collection |
| POST | `/sync/pull` | Pull records modified since `lastPulledAt` per collection |

#### Presence

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/me/presence` | Get own presence status |

### Timehuddle Routes (`/api/timehuddle`)

#### Team Management

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/teams` | Create team |
| GET | `/teams` | List user's teams |
| PUT | `/teams/:id` | Update team |
| DELETE | `/teams/:id` | Delete team (leader only) |
| POST | `/teams/:id/invite` | Generate invite deeplink |
| POST | `/teams/:id/join` | Join via invite token |
| POST | `/teams/:id/members` | Add member directly (leader) |
| DELETE | `/teams/:id/members/:userId` | Remove member |
| PUT | `/teams/:id/members/:userId/role` | Update role |
| GET | `/teams/:id/members` | List members with online/offline status |

#### Team Tickets

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/teams/:id/tickets` | Create ticket (`source: "timehuddle"`) |
| GET | `/teams/:id/tickets` | List team tickets |
| PUT | `/teams/:id/tickets/:ticketId` | Update ticket |
| DELETE | `/teams/:id/tickets/:ticketId` | Delete ticket |
| POST | `/teams/:id/tickets/:ticketId/assign` | Assign to user → bridges to Timeharbor |

#### Stories / Pulse Feed

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/teams/:id/stories` | Stories feed (pulse videos grouped by user) |
| POST | `/teams/:id/stories/:pulseId/view` | Mark story as viewed |

#### Dashboard & Presence

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/dashboard` | Team overview (active members, ticket stats) |
| GET | `/teams/:id/activity` | Team activity feed |
| GET | `/teams/:id/presence` | Online/offline status for all members |

### Bridge Routes (`/api/bridge`)

#### Account Linking

| Method | Endpoint | Source App | Purpose |
|--------|----------|-----------|---------|
| POST | `/link/generate` | Timehuddle | Generate deeplink token |
| POST | `/link/accept` | Timeharbor | Accept deeplink, link profiles |
| GET | `/link/status` | Both | Check if profiles are linked |
| POST | `/link/revoke` | Both | Unlink profiles |

#### Cross-App Data

| Method | Endpoint | Source App | Purpose |
|--------|----------|-----------|---------|
| GET | `/sharing-preferences` | Both | Get sharing preferences |
| PUT | `/sharing-preferences` | Both | Update sharing preferences |
| POST | `/share-ticket` | Timeharbor | Share personal ticket with Timehuddle |
| POST | `/assign-ticket` | Timehuddle | Assign ticket → creates in Timeharbor |
| POST | `/sync-timer` | Both | Propagate ticket timer across apps |
| GET | `/tickets/:ticketId/events` | Both | All time events for a bridged ticket |
| PATCH | `/tickets/:ticketId/status` | Timehuddle | Update status → reflected in Timeharbor |
| GET | `/events` | Both | Bridge event audit log |

---

## Offline-First Sync Engine

### How It Works

Dexie.js is the **single source of truth** in Timeharbor. The SyncEngine runs in the background:

```
┌─────────────────────────────────────────────────────────┐
│                    SyncEngine Flow                       │
│                                                         │
│  Trigger: app online / pull-to-refresh / 30s timer /    │
│           after local mutation (debounced 2s)           │
│                                                         │
│  1. PUSH ──────────────────────────────────────────     │
│     Query Dexie: all records where _dirty === 1         │
│     POST /sync/push { mutations: [...] }                │
│     Server: insert / field-merge / archive conflicts    │
│     Client: set _dirty: 0, apply merged result          │
│                                                         │
│  2. PULL ──────────────────────────────────────────     │
│     Read lastPulledAt from Dexie syncMeta               │
│     POST /sync/pull { since: lastPulledAt }             │
│     Server: return records modified since timestamp      │
│     Client: upsert into Dexie, preserve local dirty     │
│     Update lastPulledAt                                 │
└─────────────────────────────────────────────────────────┘
```

### Sync Metadata on Dexie Records

Every editable record in Dexie carries these fields:

| Field | Type | Purpose |
|-------|------|---------|
| `_serverId` | string? | MongoDB `_id` (null until first sync) |
| `_dirty` | 0 \| 1 | 1 = needs push to server |
| `_deleted` | 0 \| 1 | Soft delete, propagated on sync |
| `_rev` | number | Incremented on each local edit |
| `_lastModifiedAt` | ISO string | Last local change timestamp |
| `_fieldTimestamps` | `{ [field]: timestamp }` | Per-field timestamps for merge |

### Conflict Resolution: Field-Level Merge

| Data Category | Strategy | Conflicts? |
|--------------|----------|-----------|
| **Append-only** (workLogs, activityLogs) | Dedup by `clientEventId` / `activityId` — insert, skip duplicates | Never |
| **Editable entities** (tickets, projects) | Compare per-field timestamps — newer wins. Losing version archived in `_conflicts[]` | Archived, never lost |
| **Server-authoritative** (notifications, stats, pulse) | Client only pulls. `markAsRead` is only client→server mutation | Never |
| **Profile** | Single owner, last-write-wins per field | N/A in practice |

### Dexie Tables (v10 Schema)

| Table | Indexed Fields | Sync |
|-------|---------------|------|
| `profile` | `key, app` | Pull |
| `events` | `id, clientEventId, userId, type, timestamp, synced, teamId, sourceApp, bridged` | Push-only |
| `teams` | `id, _serverId` | Pull-only |
| `members` | `id, _serverId, userId, teamId` | Pull-only |
| `tickets` | `id, _serverId, teamId, createdBy, source, _dirty, _deleted, _rev, updatedAt` | Bi-directional / Pull |
| `projects` | `id, _serverId, createdBy, _dirty, _deleted, _rev` | Bi-directional |
| `dashboardStats` | `teamId` | Pull-only |
| `dashboardActivity` | `id, teamId` | Pull-only |
| `activityLogs` | `id, activityId, teamId, startTime, _dirty` | Push-mostly |
| `notifications` | `id, _serverId, userId, readAt, _dirty` | Pull-mostly |
| `workLogReplies` | `id, _serverId, workLogId, _dirty` | Bi-directional |
| `pulseAttachments` | `id, _serverId, ticketId, teamId` | Pull-only |
| `pulseStories` | `id, teamId, requestedBy, uploadedAt` | Pull-only |
| `syncMeta` | `collection` | Local |
| `sharingPreferences` | `userId, shareWith` | Pull |
| `bridgeEvents` | `id, ticketId, type, createdAt` | Pull-only |
| `teamPresence` | `id, teamId, userId, status` | Ephemeral (WebSocket) |

---

## Cross-App Data Flow

### Account Linking via Deeplink

```
1. User logs into Timehuddle
2. Timehuddle settings → "Link to Timeharbor" → generates deeplink
   POST /api/bridge/link/generate
   → { token: "abc123", deeplink: "timeharbor://link?token=abc123" }

3. User opens deeplink in Timeharbor
   POST /api/bridge/link/accept { token: "abc123" }
   → Server verifies same auth userId on both profiles
   → Sets linkedProfileId on both profile documents
   → accountLinks.status → "completed"

4. From this point forward:
   ✓ Timeharbor sees Timehuddle teams (read-only)
   ✓ Assigned tickets flow into Timeharbor
   ✓ Ticket timers bridge between apps
   ✓ Stories feed available from linked teams
```

### What Syncs Between Apps

| Data | Direction | Condition |
|------|-----------|-----------|
| Team membership | Timehuddle → Timeharbor (read-only) | Profiles linked |
| Ticket assigned to user | Timehuddle → Timeharbor | Profiles linked |
| Personal ticket shared | Timeharbor → Timehuddle | User opts in per-ticket |
| Ticket timer (start/stop) | Bidirectional | Ticket is bridged + linked |
| Clock in/out | **No sync** | App-scoped (Timeharbor only) |
| Break start/end | **No sync** | App-scoped |
| Ticket status changes | Timehuddle → Timeharbor | Ticket is bridged |
| Pulse / stories | Available in both | Linked + team membership |
| Presence (online/offline) | Real-time via WebSocket | Team membership |
| Notifications | Server creates cross-app | Via bridgeEvents |

### Timer Bridging (Bidirectional)

When a user starts/stops a ticket timer in one app, it reflects in the other:

```
User starts timer in Timeharbor on a Timehuddle ticket:
  → workLog { type: "START_TICKET", sourceApp: "timeharbor" } → Dexie
  → SyncEngine pushes to /api/timeharbor/time/sync-events
  → Server checks: is this ticket bridged? Are profiles linked?
  → YES → Create mirrored workLog { bridged: true }
       → Insert bridgeEvents { type: "timer_synced" }
       → Emit WebSocket to Timehuddle: "timer_started"
  → Timehuddle sees the timer state immediately
```

**Loop prevention**: Bridged events have `bridged: true` — the server never re-bridges an already-bridged event.

---

## WebSocket Presence

Real-time online/offline indicators for team members.

### Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `connect` | Client → Server | Create `presenceHeartbeats` entry, broadcast `member_online` |
| `ping` | Client → Server (every 30s) | Update `lastPingAt` |
| `disconnect` | Client → Server | Remove entry, broadcast `member_offline` |
| `presence_update` | Server → Clients | Status change broadcast |
| `timer_update` | Server → Clients | Real-time ticket timer state |

### Green Indicator Logic

- Server creates a `presenceHeartbeats` document on connect
- Client sends `ping` every 30 seconds
- MongoDB TTL index on `lastPingAt` auto-deletes after 2 minutes of no ping
- Team members receive `member_online` / `member_offline` via WebSocket
- Both apps show green (online) / grey (offline) indicator on avatars

---

## Background Jobs

| Job | Trigger | Purpose |
|-----|---------|---------|
| Auto-close orphaned sessions | Cron (hourly) | Find `CLOCK_IN` without matching `CLOCK_OUT` after 12h → auto-create `CLOCK_OUT` |
| Cleanup expired pulse | Cron (daily) | Delete `pulseAttachments` where `status: "pending"` and `expiresAt < now` |
| Recompute daily stats | On time sync | Recalculate `userDailyStats` from `workLogs` for affected `(userId, teamId, date)` tuples |
| Stale presence cleanup | TTL index | MongoDB automatically removes `presenceHeartbeats` after 2 min stale |
| Expired link cleanup | Cron (daily) | Set `accountLinks.status → "expired"` where `expiresAt < now` and status is `"pending"` |

---

## Execution Plan

### Phase Diagram

```
Phase 1   Collections & Indexes        ← START HERE (no deps)
    │
    ├──→ Phase 2   Timeharbor API       ← depends on Phase 1
    │        │
    │        ├──→ Phase 2.5  Timehuddle API + Bridge + Linking
    │        │               + Presence + Stories
    │        │
    │        └──→ Phase 5   Background Jobs
    │
    ├──→ Phase 3   Dexie Schema         ← PARALLEL with Phase 2
    │
    └──→ Phase 4   Sync Engine          ← depends on Phase 2 + 3
              │
              ├──→ Phase 4.5  Cross-App Data Flow
              │
              └──→ Phase 6   Frontend Wiring + Stories UI
                              + Presence Indicators
```

### Phase 1: MongoDB Collections & Data Layer

1. Create TypeScript interfaces for all 17 collections in `apps/api/src/models/`
2. Extend `models/index.ts` with `getCollection()` accessors for each collection
3. Create `scripts/setup-collections.ts` to ensure all indexes on first deploy
4. Run script, verify in MongoDB Compass

### Phase 2: Timeharbor API Endpoints

Build all Timeharbor-specific endpoints (~35 endpoints):
- Profile CRUD, personal ticket CRUD, time sync, dashboard, activity logs, notifications, projects, pulse, sync gateway
- Each endpoint: route file + controller + service + Fastify JSON Schema validation
- Reference: port business logic from `express-api/src/controllers/` and `services/`

### Phase 2.5: Timehuddle API + Bridge + Linking + Presence + Stories

Build Timehuddle endpoints (~25 endpoints) and cross-app infrastructure:
- Team CRUD (invite, join, member management)
- Team ticket CRUD + assignment (triggers bridge)
- Account linking via deeplink
- Bridge endpoints (share ticket, sync timer, sharing preferences)
- WebSocket presence setup in `server.ts`
- Stories feed endpoints

### Phase 3: Dexie Schema Upgrade (parallel with Phase 2)

- Upgrade Dexie to v10 with 17 tables and sync metadata fields
- Add `_serverId`, `_dirty`, `_deleted`, `_rev`, `_fieldTimestamps` to editable records
- File: `timeharbourapp/TimeharborAPI/db.ts`

### Phase 4: Sync Engine

- Rewrite `SyncManager.ts` → `SyncEngine.ts` (currently disabled/no-op)
- Implement push/pull cycle with field-level merge
- Revive `NetworkDetector.ts` with real connectivity detection
- Build server-side `sync.controller.ts` (process mutations, return merged results)

### Phase 4.5: Cross-App Data Flow

- Wire up all bridge patterns: ticket sharing, assignment, timer sync
- Test linking flow end-to-end
- Verify loop prevention (`bridged: true` check)
- Wire cross-app notifications

### Phase 5: Background Jobs (parallel with Phase 4)

- Port auto-close orphaned sessions
- Implement stats recomputation on time sync
- Cleanup expired pulse and stale links

### Phase 6: Frontend Integration

- Rewrite all `TimeharborAPI/` modules to be Dexie-first
- Use `useLiveQuery()` from Dexie for reactive UI
- Add sync status indicator (synced / syncing / offline / conflict)
- Build stories viewer component
- Add presence indicators (green/grey dots) on team member avatars
- Update auth module for Better Auth on new server
- Update Playwright tests

---

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| Full replacement of express-api | Clean break; Fastify backend already scaffolded |
| One auth identity, two profiles | Shared login but separate per-app data |
| Deeplink-based account linking | Explicit consent; Capacitor handles deeplinks natively |
| Teams are Timehuddle-owned | Timeharbor is personal; teams are read-only reflections |
| No Mongoose | Native MongoDB driver matches existing codebase |
| Dexie.js as primary store | True offline-first; instant UI; sync in background |
| Field-level conflict merge | Granular; prevents unrelated field edits from conflicting |
| `_conflicts[]` archiving | Zero data loss; users can review lost versions |
| Append-only time events | No conflicts possible; dedup by client-generated UUID |
| Unified `/sync/push` + `/sync/pull` | Single round-trip for all collections |
| `bridged: true` flag | Prevents infinite re-bridging loops |
| Clock in/out stays app-scoped | Only ticket timers bridge; clock-level data is personal |
| WebSocket presence with TTL | Auto-cleanup; no manual offline detection needed |
| Notepad stays in localStorage | No backend needed for local-only feature |
