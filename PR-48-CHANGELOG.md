# PR #48 — Timehuddle Integration Changelog

**PR**: [#48 — Timehuddle](https://github.com/Dharp02/TimeharborApp/pull/48)
**Branch**: `ui-ractor` → `main`
**Status**: Open
**Total Commits**: 44

---

## Summary

This PR introduces the **Timehuddle** platform alongside the existing Timeharbor app, replacing the legacy Express.js/PostgreSQL backend with a new **Fastify/MongoDB** backend (`timeharbor-timehuddle-backend`) added as a **git submodule**. It includes major frontend feature additions (personal tickets, projects, calendar, notepad, Pulse recordings), a new SyncEngine for offline-first data synchronization, comprehensive architecture documentation, and significant code cleanup.

---

## Major Changes

### 1. Backend Migration: Express → Fastify

The entire `express-api/` directory has been **removed** and replaced with `timeharbor-timehuddle-backend/` (a git submodule).

| Before | After |
|--------|-------|
| Express.js | Fastify v5 |
| PostgreSQL + Sequelize ORM | MongoDB (native driver) |
| JWT auth (custom) | Better Auth |
| Socket.IO | @fastify/websocket |
| Per-event work logs | Per-session work documents |

**Deleted files** (entire `express-api/` directory):
- Config: `database.js`, `sequelize.ts`, `.env.example`, `.sequelizerc`
- Controllers: `authController.ts`, `dashboardController.ts`, `teamController.ts`, `ticketController.ts`, `timeController.ts`, `notificationController.ts`, `pulseController.ts`, `activityLogController.ts`
- Models: `User.ts`, `Team.ts`, `Member.ts`, `Ticket.ts`, `WorkLog.ts`, `RefreshToken.ts`, `Notification.ts`, `PulseAttachment.ts`, `ActivityLog.ts`, `WorkLogReply.ts`, `UserDailyStat.ts`
- Routes: `authRoutes.ts`, `dashboardRoutes.ts`, `teamRoutes.ts`, `timeRoutes.ts`, `notificationRoutes.ts`
- Services: `emailService.ts`, `notificationService.ts`, `pulseVaultService.ts`, `sessionStateService.ts`
- Middleware: `authMiddleware.ts`, `errorHandler.ts`, `time.ts`
- Socket: `socketManager.ts`
- Jobs: `cleanupTokens.ts`, `cleanupPulseAttachments.ts`
- Scripts: `backfillDailyStats.ts`, `clearData.ts`
- Migrations (all Sequelize migration files)
- Utils: `logger.ts`
- `package.json`, `package-lock.json`, `tsconfig.json`, `index.ts`

### 2. New Backend Submodule

Added `.gitmodules` with the new backend:
```
[submodule "timeharbor-timehuddle-backend"]
    path = timeharbor-timehuddle-backend
    url = https://github.com/Dharp02/timeharbor-timehuddle-backend.git
```

Monorepo structure:
- `apps/api/` — Fastify API server
- `packages/time-engine/` — Shared `@timeharbor/time-engine` calculation module (zero dependencies, pure TypeScript)

### 3. Architecture Documentation

Two comprehensive architecture docs added:

- **`ARCHITECTURE.md`** (895 lines) — Full system architecture for Timeharbor + Timehuddle:
  - 17 MongoDB collection schemas with indexes
  - All API endpoints (~60+ routes across Timeharbor, Timehuddle, and Bridge APIs)
  - Offline-first sync engine design (push/pull, field-level conflict merge)
  - Cross-app data flow via deeplink-based account linking
  - WebSocket presence system
  - Background jobs spec
  - 6-phase execution plan

- **`TIMEHARBOR-CORE.md`** (846 lines) — Core Timeharbor implementation details:
  - Per-session data model (replacing per-event work logs)
  - `@timeharbor/time-engine` shared calculation module (`computeSession`, `computeDay`)
  - Three data layers: raw data → derived stats → daily aggregates
  - Offline ↔ online sync strategy
  - Multi-device conflict prevention
  - Dexie.js schema design
  - Sync contract (push/pull endpoints)

---

## Commit-by-Commit Breakdown

### Cross-Device Session Sync
- **`02debb3`** — feat: implement session state management for cross-device synchronization
- **`f09d5f6`** — feat: enhance activity synchronization and UI state management across components
- **`9e01aca`** — feat: synchronize BREAK_START and BREAK_END work-logs with the backend for real-time session state updates

### Activity & Dashboard Enhancements
- **`6f210c8`** — feat: enhance activity logging and management across dashboard components
- **`8c922ad`** — feat: update RecentActivity component to fetch activities by date range and improve UI layout
- **`d57d99e`** — feat: enhance dashboard event handling and UI components for improved user experience
- **`ea3e406`** — feat: enhance RecentActivity component to parse descriptions and display clickable URLs
- **`4b9c800`** — Refactor dashboard layout and components for improved performance and user experience
- **`4fc0356`** — removed teams dependency code from most of the components

### Pulse Recording Feature
- **`b3462ec`** — feat(pulse): implement Pulse recording feature with attachment management
- **`7ad78ae`** — feat(pulse): enhance session management by allowing resumption of existing recordings; update PulseAttachment model
- **`570fc3b`** — feat(pulse): add PulseButton component and integrate into TicketsPage; create PulseLogoIcon
- **`561bd1d`** — feat: add Pulse recording feature with attachment management

### Ticket Management
- **`73cb8db`** — feat: implement personal ticket management with create, update, delete, and fetch functionalities
- **`47da346`** — feat: enhance ticket components with GitHub URL resolution and clickable links
- **`0928c65`** — feat: Implement ticket editing functionality and enhance ticket management UI
- **`4a5fcef`** — feat(tickets): disable ticket timers when break button is activated
- **`a7b7bb9`** — feat(tickets): add GitHub title fetching on title and reference blur events
- **`1aebd5e`** — feat(tickets): auto-generate GitHub links for ticket titles and enhance ticket link handling

### Member Activity & Break Events
- **`73835bc`** — feat(activity): enhance member activity display for break events; update ClockEventItem
- **`02b5580`** — fix(activity): improve member activity display by merging repeated ticket entries; update duration calculations
- **`504eed8`** — feat(activity): implement LinkifiedText component for clickable URLs in comments and replies

### Profile & Social Links
- **`48cb863`** — feat(profile): add GitHub and LinkedIn fields to user profile; update profile handling
- **`5014b27`** — feat: add social media links to user profiles and update related components

### UI & Text Utilities
- **`12b9d93`** — feat: implement linkifyText utility for clickable URLs in comments; update TicketItem and TeamActivityReport
- **`36a1225`** — feat: add scroll to top functionality on route change in DashboardLayout
- **`cdd06a3`** — refactor: remove legacy date range components; introduce new DateRangePickerWithPresets

### Calendar & Projects
- **`a3bda81`** — feat: Add FullCalendar integration with custom styling and event handling
- **`871c0a8`** — feat: Implement project management features including CRUD operations and UI integration

### Auth & Session Management
- **`38a22e9`** — feat: implement admin bypass functionality for authentication and session management
- **`2898991`** — fix: improve error handling in session and user retrieval
- **`9ff775b`** — feat: implement auto-close functionality for orphaned sessions and enhance related components

### SyncEngine
- **`e1f82c9`** — feat: implement SyncEngine for work sessions and tickets synchronization

### Notepad / Blocknote
- **`2784d24`** — chore: update package.json to include Blocknote dependencies

### Cache & Cleanup
- **`3be0e50`** — feat: add cache clearing functionality to AppSidebar
- **`8114f66`** — refactor: remove unused models, routes, services, and utilities
- **`65f133f`** — Remove error log file to clean up repository; prevent sensitive information exposure

### Code Quality & Refactoring
- **`89f956f`** — Refactor code structure for improved readability and maintainability
- **`871116d`** — Refactor code structure for improved readability and maintainability

### Infrastructure & Config
- **`935e176`** — feat: add timeharbor-timehuddle-backend submodule
- **`5a2ed29`** — chore: update timeharbor-timehuddle-backend submodule
- **`48dadd4`** — edited ecosystem config file
- **`fc6409e`** — fix: update subproject commit to indicate dirty state

### Merge Commits
- **`c09a1aa`** — Merge pull request #45: auto-generate heading links and profile references in GitHub content
- **`ed4fe8b`** — Merge pull request #43: fix member page activity display for break events and single ticket updates
- **`7a4772d`** — Merge pull request #41: disable ticket timers when break button is activated
- **`eaa68ed`** — Merge pull request #39: integrating pulse
- **`b95c0e9`** — Merge pull request #38: time computing

---

## Deployment Configuration Changes

### `ecosystem.config.js` (local dev)
- Backend `cwd` changed from `express-api` → `timeharbor-timehuddle-backend/apps/api`
- Backend script changed from `npm run dev` → `npx tsx src/server.ts`
- Updated all paths to use the worktree directory

### `ecosystem.uat.config.js` (UAT server)
- Backend `cwd` changed from `express-api` → `timeharbor-timehuddle-backend/apps/api`
- Backend script changed from `npm run dev` → `node dist/server.js`
- Backend `NODE_ENV` changed from `development` → `production`

### `.github/workflows/deploy-uat.yml`
- Install dependencies for `timeharbor-timehuddle-backend` instead of `express-api`
- Build step changed to target `apps/api` with Fastify build
- Removed Sequelize migration steps (no longer needed with MongoDB)

### `.gitignore`
- Added `.playwright-mcp`

---

## Frontend Feature Summary

| Feature | Description |
|---------|-------------|
| **Personal Tickets** | Full CRUD for personal ticket management without team dependency |
| **Project Management** | Create, update, delete projects; assign tickets to projects |
| **FullCalendar** | Calendar integration with custom styling and event handling |
| **Notepad (Blocknote)** | Rich text notepad using Blocknote editor |
| **Pulse Recordings** | Video recording feature with QR codes and deeplink support |
| **SyncEngine** | New offline-first sync engine for work sessions and tickets |
| **DateRangePickerWithPresets** | Replaced legacy date range components |
| **LinkifiedText** | Utility for auto-linking URLs in comments and descriptions |
| **GitHub URL Resolution** | Auto-fetch GitHub issue/PR titles from URLs |
| **Profile Social Links** | GitHub and LinkedIn profile fields |
| **Cross-Device Session Sync** | Session state management across multiple devices |
| **Admin Bypass Auth** | Admin authentication bypass for development |
| **Auto-Close Orphaned Sessions** | Automatic cleanup of sessions left open > 12 hours |
| **Cache Clearing** | Cache clear button in AppSidebar |
| **Scroll to Top** | Auto-scroll to top on route change |

---

## Breaking Changes

1. **Backend URL/API changes** — All endpoints now go through the Fastify backend instead of Express. Route paths have changed (e.g., `/api/timeharbor/*` prefix).
2. **Auth system** — Migrated from custom JWT to Better Auth. Token format and auth flow have changed.
3. **Database** — PostgreSQL → MongoDB. All data models restructured.
4. **Work log model** — Moved from per-event rows to per-session documents with embedded ticket segments and breaks.
5. **Teams removed from core flow** — Teams dependency removed from most frontend components; personal tickets now work independently.

---

## Stats

| Metric | Count |
|--------|-------|
| Commits | 44 |
| Files changed | 70+ |
| Lines added | ~2,500+ |
| Lines removed | ~10,000+ |
| Files added | 5 (`.gitmodules`, `ARCHITECTURE.md`, `TIMEHARBOR-CORE.md`, + submodule) |
| Files deleted | 30+ (entire `express-api/`) |
| Files modified | ~35 |
