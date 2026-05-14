import { test, expect, type Page } from '@playwright/test';

// ─── Locator helpers ──────────────────────────────────────────────────────────
/** Matches the save/error toast, excluding Next.js route announcer (role="alert"). */
const saveAlert = (p: Page) => p.locator('[role="alert"]:not(#__next-route-announcer__)');
/** Scopes text locators to the mobile-card section (the hidden md:block table is excluded). */
const mobileList = (p: Page) => p.locator('[class*="md:hidden"]');

/**
 * Timesheet Entry E2E Tests
 *
 * Covers:
 *  - Editing existing entries: start/end time, ticket, description, flag, status
 *  - Creating new manual entries via the "+ Add Entry" button
 *  - Validation: future time prevention, end-before-start, active session guard
 *  - Stats: total hours display updates after editing session duration
 *  - Sync queue: CREATE / UPDATE / DELETE operations appear in opLog
 *  - Date range filter presets: Today, Yesterday, Past Week
 *
 * Note: Sync queue tests verify the opLog IndexedDB entries directly.
 * The sync logs UI (Sync Queue / Operation Logs) is left untouched — tests
 * only observe its state via IndexedDB reads and a brief navigation check.
 */

test.use({
  viewport: { width: 390, height: 844 }, // iPhone — shows mobile card layout
  navigationTimeout: 30_000,
});

// ─── Date helpers ─────────────────────────────────────────────────────────────

/** Today's date as YYYY-MM-DD in local time (matches Luxon DateTime.now().toISODate()). */
function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Yesterday's date as YYYY-MM-DD in local time. */
function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** N days ago as YYYY-MM-DD in local time. */
function daysAgoStr(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Epoch ms for a given YYYY-MM-DD at HH:MM in local time.
 * Uses `new Date(year, month-1, day, hh, mm)` to stay in local time zone,
 * matching how the app stores clockIn / clockOut.
 */
function localMs(dateStr: string, hh: number, mm: number): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0).getTime();
}

// ─── IndexedDB helpers ────────────────────────────────────────────────────────

async function seedWorkSession(page: Page, session: Record<string, unknown>): Promise<void> {
  await page.evaluate(async (s) => {
    const uuid = localStorage.getItem('th_identity_uuid');
    const dbName = uuid ? `TimeharborDB_${uuid}` : 'TimeharborDB';
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open(dbName);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('workSessions', 'readwrite');
        tx.objectStore('workSessions').put(s);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      };
    });
  }, session);
}

async function getWorkSession(page: Page, sessionId: string): Promise<Record<string, unknown> | null> {
  return page.evaluate(async (id) => {
    const uuid = localStorage.getItem('th_identity_uuid');
    const dbName = uuid ? `TimeharborDB_${uuid}` : 'TimeharborDB';
    return new Promise<Record<string, unknown> | null>((resolve, reject) => {
      const req = indexedDB.open(dbName);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('workSessions', 'readonly');
        const getReq = tx.objectStore('workSessions').get(id);
        getReq.onsuccess = () => resolve((getReq.result as Record<string, unknown>) ?? null);
        getReq.onerror = () => reject(getReq.error);
      };
    });
  }, sessionId);
}

async function getOpLogEntries(page: Page): Promise<Record<string, unknown>[]> {
  return page.evaluate(async () => {
    const uuid = localStorage.getItem('th_identity_uuid');
    const dbName = uuid ? `TimeharborDB_${uuid}` : 'TimeharborDB';
    return new Promise<Record<string, unknown>[]>((resolve, reject) => {
      const req = indexedDB.open(dbName);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('opLog')) { resolve([]); return; }
        const tx = db.transaction('opLog', 'readonly');
        const store = tx.objectStore('opLog');
        const getAll = store.getAll();
        getAll.onsuccess = () => resolve(getAll.result as Record<string, unknown>[]);
        getAll.onerror = () => reject(getAll.error);
      };
    });
  });
}

// ─── Session factory ──────────────────────────────────────────────────────────

let _sessionCounter = 0;

function makeSession(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const now = Date.now();
  const id = `test-ts-${now}-${++_sessionCounter}`;
  const date = (overrides.date as string) ?? yesterdayStr();
  const clockIn = (overrides.clockIn as number) ?? localMs(date, 8, 0);
  const clockOut = (overrides.clockOut !== undefined ? overrides.clockOut : localMs(date, 9, 0)) as number | null;
  const netWorkMs = clockOut !== null ? clockOut - clockIn : 0;

  return {
    clientSessionId: `cs-${id}`,
    userId: 'test-user',
    ticketSegments: [],
    breaks: [],
    ticketBreakdown: [],
    sourceApp: 'timeharbor',
    createdAt: now,
    totalBreakMs: 0,
    ...overrides,
    id,           // id is always the generated one (not overrideable)
    date,
    clockIn,
    clockOut,
    netWorkMs: overrides.netWorkMs ?? netWorkMs,
    totalSessionMs: overrides.totalSessionMs ?? netWorkMs,
    updatedAt: now,
  };
}

// ─── Navigation helpers ───────────────────────────────────────────────────────

/** Navigate to the timesheet page and wait for data to load. */
async function gotoTimesheet(page: Page): Promise<void> {
  await page.goto('/dashboard/settings/timesheet');
  await page.waitForLoadState('networkidle');
  // Wait for the loading spinner to disappear
  await page.waitForFunction(
    () => document.querySelectorAll('.animate-spin').length === 0,
    { timeout: 10_000 },
  );
  // Small settling pause for React state updates
  await page.waitForTimeout(300);
}

/**
 * Click the edit button on the first mobile card matching the given title text.
 * Falls back to the very first edit button if no title is given.
 */
async function clickEditOnCard(page: Page, titleText?: string): Promise<void> {
  if (titleText) {
    const card = page.locator('div.p-4').filter({ hasText: titleText });
    await card.getByRole('button', { name: 'Edit entry' }).first().click();
  } else {
    await page.getByRole('button', { name: 'Edit entry' }).first().click();
  }
}

// ─── Shared setup ─────────────────────────────────────────────────────────────

/**
 * Navigate to /dashboard first so the app initialises its identity UUID,
 * which determines the IndexedDB database name used for seeding.
 */
async function initApp(page: Page): Promise<void> {
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. EDIT EXISTING ENTRY
// ═════════════════════════════════════════════════════════════════════════════

test.describe('Timesheet: edit existing entry', () => {
  test.beforeEach(async ({ page }) => {
    await initApp(page);
  });

  test('can edit start and end times of a past session', async ({ page }) => {
    const session = makeSession({
      date: todayStr(),
      clockIn: localMs(todayStr(), 8, 0),
      clockOut: localMs(todayStr(), 9, 0),
      netWorkMs: 3_600_000,
      totalSessionMs: 3_600_000,
    });
    await seedWorkSession(page, session);
    await gotoTimesheet(page);

    // Today's accordion auto-expands — click edit on the "Session Ended" card
    await clickEditOnCard(page, 'Session Ended');

    await page.getByLabel('Start').fill('07:30');
    await page.getByLabel('End').fill('08:45');
    await page.getByRole('button', { name: /Save/ }).click();

    await expect(saveAlert(page)).toContainText('Entry saved');
    await expect(mobileList(page).getByText('7:30 AM').first()).toBeVisible();
    await expect(mobileList(page).getByText('8:45 AM').first()).toBeVisible();
  });

  test('can edit the ticket name of a past session', async ({ page }) => {
    const session = makeSession({
      date: todayStr(),
      clockIn: localMs(todayStr(), 10, 0),
      clockOut: localMs(todayStr(), 11, 0),
      netWorkMs: 3_600_000,
      totalSessionMs: 3_600_000,
    });
    await seedWorkSession(page, session);
    await gotoTimesheet(page);

    await clickEditOnCard(page, 'Session Ended');
    await mobileList(page).getByPlaceholder('TKT-123').fill('PRJ-999');
    await page.getByRole('button', { name: /Save/ }).click();

    await expect(saveAlert(page)).toContainText('Entry saved');
    await expect(mobileList(page).getByText('PRJ-999').first()).toBeVisible();
  });

  test('can edit the description of a past session', async ({ page }) => {
    const session = makeSession({
      date: todayStr(),
      clockIn: localMs(todayStr(), 9, 0),
      clockOut: localMs(todayStr(), 10, 0),
      netWorkMs: 3_600_000,
      totalSessionMs: 3_600_000,
    });
    await seedWorkSession(page, session);
    await gotoTimesheet(page);

    await clickEditOnCard(page, 'Session Ended');
    await mobileList(page).getByPlaceholder('What did you work on?').fill('Reviewed the PR carefully');
    await page.getByRole('button', { name: /Save/ }).click();

    await expect(saveAlert(page)).toContainText('Entry saved');
    await expect(mobileList(page).getByText('Reviewed the PR carefully').first()).toBeVisible();
  });

  test('can change the flag on a past session', async ({ page }) => {
    const session = makeSession({
      date: todayStr(),
      clockIn: localMs(todayStr(), 8, 0),
      clockOut: localMs(todayStr(), 9, 0),
      netWorkMs: 3_600_000,
      totalSessionMs: 3_600_000,
    });
    await seedWorkSession(page, session);
    await gotoTimesheet(page);

    await clickEditOnCard(page, 'Session Ended');

    // Flag is a @mieweb/ui Select — attempt via getByLabel; falls back to native <select>
    const flagSelect = page.locator('#ts-edit-flag');
    await flagSelect.selectOption('billable');
    await page.getByRole('button', { name: /Save/ }).click();

    await expect(saveAlert(page)).toContainText('Entry saved');

    // Verify persisted value in IndexedDB
    const updated = await getWorkSession(page, session.id as string);
    expect(updated?.flag).toBe('billable');
  });

  test('can change the status on a past session', async ({ page }) => {
    const session = makeSession({
      date: todayStr(),
      clockIn: localMs(todayStr(), 8, 0),
      clockOut: localMs(todayStr(), 9, 0),
      netWorkMs: 3_600_000,
      totalSessionMs: 3_600_000,
    });
    await seedWorkSession(page, session);
    await gotoTimesheet(page);

    await clickEditOnCard(page, 'Session Ended');

    const statusSelect = page.locator('#ts-edit-status');
    await statusSelect.selectOption('Pending');
    await page.getByRole('button', { name: /Save/ }).click();

    await expect(saveAlert(page)).toContainText('Entry saved');

    const updated = await getWorkSession(page, session.id as string);
    expect(updated?.manualStatus).toBe('Pending');
  });

  test('edit persists in IndexedDB after saving', async ({ page }) => {
    const session = makeSession({
      date: todayStr(),
      clockIn: localMs(todayStr(), 9, 0),
      clockOut: localMs(todayStr(), 10, 0),
      netWorkMs: 3_600_000,
      totalSessionMs: 3_600_000,
    });
    await seedWorkSession(page, session);
    await gotoTimesheet(page);

    await clickEditOnCard(page, 'Session Ended');
    await mobileList(page).getByPlaceholder('TKT-123').fill('SAVED-42');
    await page.getByRole('button', { name: /Save/ }).click();
    await expect(saveAlert(page)).toContainText('Entry saved');

    const updated = await getWorkSession(page, session.id as string);
    expect(updated).not.toBeNull();
    expect(updated?.manualTicket).toBe('SAVED-42');
  });

  test('cancel discards changes', async ({ page }) => {
    const session = makeSession({
      date: todayStr(),
      clockIn: localMs(todayStr(), 8, 0),
      clockOut: localMs(todayStr(), 9, 0),
      netWorkMs: 3_600_000,
      totalSessionMs: 3_600_000,
    });
    await seedWorkSession(page, session);
    await gotoTimesheet(page);

    await clickEditOnCard(page, 'Session Ended');
    await mobileList(page).getByPlaceholder('TKT-123').fill('SHOULD-NOT-SAVE');
    await page.getByRole('button', { name: /Cancel/ }).click();

    // Entry not saved — ticket should NOT be visible
    await expect(page.getByText('SHOULD-NOT-SAVE')).not.toBeVisible();

    const unchanged = await getWorkSession(page, session.id as string);
    expect(unchanged?.manualTicket).not.toBe('SHOULD-NOT-SAVE');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 2. CREATE NEW ENTRY
// ═════════════════════════════════════════════════════════════════════════════

test.describe('Timesheet: create new entry', () => {
  test.beforeEach(async ({ page }) => {
    await initApp(page);
  });

  test('add entry button opens edit form', async ({ page }) => {
    await gotoTimesheet(page);
    await page.getByRole('button', { name: 'Add timesheet entry' }).click();

    await expect(mobileList(page).getByPlaceholder('TKT-123')).toBeVisible();
    await expect(mobileList(page).getByPlaceholder('What did you work on?')).toBeVisible();
    await expect(page.getByRole('button', { name: /Save/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Cancel/ })).toBeVisible();
  });

  test('can create a new manual entry with valid past times', async ({ page }) => {
    await gotoTimesheet(page);
    await page.getByRole('button', { name: 'Add timesheet entry' }).click();

    await page.getByLabel('Start').fill('06:00');
    await page.getByLabel('End').fill('07:00');
    await mobileList(page).getByPlaceholder('TKT-123').fill('NEW-001');
    await mobileList(page).getByPlaceholder('What did you work on?').fill('Created via test');
    await page.getByRole('button', { name: /Save/ }).click();

    await expect(saveAlert(page)).toContainText('Entry saved');
    await expect(mobileList(page).getByText('NEW-001').first()).toBeVisible();
  });

  test('new entry persists in IndexedDB', async ({ page }) => {
    await gotoTimesheet(page);
    await page.getByRole('button', { name: 'Add timesheet entry' }).click();

    await page.getByLabel('Start').fill('05:00');
    await page.getByLabel('End').fill('05:30');
    await mobileList(page).getByPlaceholder('TKT-123').fill('PERSIST-007');
    await page.getByRole('button', { name: /Save/ }).click();

    await expect(saveAlert(page)).toContainText('Entry saved');

    // Scan IndexedDB for the persisted session
    const found = await page.evaluate(async () => {
      const uuid = localStorage.getItem('th_identity_uuid');
      const dbName = uuid ? `TimeharborDB_${uuid}` : 'TimeharborDB';
      return new Promise<Record<string, unknown> | null>((resolve, reject) => {
        const req = indexedDB.open(dbName);
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('workSessions', 'readonly');
          const store = tx.objectStore('workSessions');
          const getAll = store.getAll();
          getAll.onsuccess = () => {
            const match = (getAll.result as Record<string, unknown>[]).find(
              (s) => s.manualTicket === 'PERSIST-007',
            );
            resolve(match ?? null);
          };
          getAll.onerror = () => reject(getAll.error);
        };
      });
    });

    expect(found).not.toBeNull();
    expect(found?.manualTicket).toBe('PERSIST-007');
  });

  test('cancelling new entry removes it from the list', async ({ page }) => {
    await gotoTimesheet(page);
    await page.getByRole('button', { name: 'Add timesheet entry' }).click();
    await mobileList(page).getByPlaceholder('TKT-123').fill('CANCEL-ME');
    await page.getByRole('button', { name: /Cancel/ }).click();

    // The card in edit mode should be gone
    await expect(page.getByText('CANCEL-ME')).not.toBeVisible();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 3. VALIDATION
// ═════════════════════════════════════════════════════════════════════════════

test.describe('Timesheet: validation', () => {
  test.beforeEach(async ({ page }) => {
    await initApp(page);
  });

  test('rejects start time in the future', async ({ page }) => {
    test.skip(
      new Date().getHours() >= 23,
      'Skipped: cannot reliably test future time after 23:00',
    );

    await gotoTimesheet(page);
    await page.getByRole('button', { name: 'Add timesheet entry' }).click();

    // 23:59 on today's date is always in the future before midnight
    await page.getByLabel('Start').fill('23:59');
    await page.getByLabel('End').fill('23:59');
    await page.getByRole('button', { name: /Save/ }).click();

    await expect(saveAlert(page)).toContainText('future');
  });

  test('rejects end time in the future', async ({ page }) => {
    test.skip(
      new Date().getHours() >= 23,
      'Skipped: cannot reliably test future time after 23:00',
    );

    await gotoTimesheet(page);
    await page.getByRole('button', { name: 'Add timesheet entry' }).click();

    await page.getByLabel('Start').fill('01:00');
    await page.getByLabel('End').fill('23:59'); // future
    await page.getByRole('button', { name: /Save/ }).click();

    await expect(saveAlert(page)).toContainText('future');
  });

  test('rejects end time that is before start time', async ({ page }) => {
    await gotoTimesheet(page);
    await page.getByRole('button', { name: 'Add timesheet entry' }).click();

    await page.getByLabel('Start').fill('09:00');
    await page.getByLabel('End').fill('08:00'); // before start
    await page.getByRole('button', { name: /Save/ }).click();

    await expect(saveAlert(page)).toContainText('after start');
  });

  test('prevents editing an active (running) session', async ({ page }) => {
    // Seed an open session: clockOut === null → status = 'Active'
    const session = makeSession({
      date: todayStr(),
      clockIn: localMs(todayStr(), 8, 0),
      clockOut: null,
      netWorkMs: 0,
      totalSessionMs: 0,
    });
    await seedWorkSession(page, session);
    await gotoTimesheet(page);

    // Only "Work Session Started" card appears for active sessions
    await clickEditOnCard(page, 'Work Session Started');

    await expect(saveAlert(page)).toContainText('Active sessions cannot be edited');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 4. STATS UPDATE
// ═════════════════════════════════════════════════════════════════════════════

test.describe('Timesheet: stats update after edit', () => {
  test.beforeEach(async ({ page }) => {
    await initApp(page);
  });

  test('total time header updates after extending a session', async ({ page }) => {
    // Seed a 1-hour session today (netWorkMs = 1h = 3 600 000 ms → "1h 0m")
    const session = makeSession({
      date: todayStr(),
      clockIn: localMs(todayStr(), 8, 0),
      clockOut: localMs(todayStr(), 9, 0),
      netWorkMs: 3_600_000,
      totalSessionMs: 3_600_000,
    });
    await seedWorkSession(page, session);
    await gotoTimesheet(page);

    // Verify initial total shows "1h 0m"
    await expect(page.getByTestId('total-hours')).toContainText('1h 0m');

    // Edit to extend to 2 hours (08:00 → 10:00)
    await clickEditOnCard(page, 'Session Ended');
    await page.getByLabel('Start').fill('08:00');
    await page.getByLabel('End').fill('10:00');
    await page.getByRole('button', { name: /Save/ }).click();

    await expect(saveAlert(page)).toContainText('Entry saved');

    // Total should now show "2h 0m"
    await expect(page.getByTestId('total-hours')).toContainText('2h 0m');
  });

  test('total time header updates after shortening a session', async ({ page }) => {
    // Seed a 2-hour session today
    const session = makeSession({
      date: todayStr(),
      clockIn: localMs(todayStr(), 8, 0),
      clockOut: localMs(todayStr(), 10, 0),
      netWorkMs: 7_200_000,
      totalSessionMs: 7_200_000,
    });
    await seedWorkSession(page, session);
    await gotoTimesheet(page);

    await expect(page.getByTestId('total-hours')).toContainText('2h 0m');

    // Edit to shorten to 30 minutes (08:00 → 08:30)
    await clickEditOnCard(page, 'Session Ended');
    await page.getByLabel('Start').fill('08:00');
    await page.getByLabel('End').fill('08:30');
    await page.getByRole('button', { name: /Save/ }).click();

    await expect(saveAlert(page)).toContainText('Entry saved');
    await expect(page.getByTestId('total-hours')).toContainText('0h 30m');
  });

  test('deleting an entry reduces the total time', async ({ page }) => {
    const session = makeSession({
      date: todayStr(),
      clockIn: localMs(todayStr(), 8, 0),
      clockOut: localMs(todayStr(), 9, 0),
      netWorkMs: 3_600_000,
      totalSessionMs: 3_600_000,
    });
    await seedWorkSession(page, session);
    await gotoTimesheet(page);

    await expect(page.getByTestId('total-hours')).toContainText('1h 0m');

    await page.getByRole('button', { name: 'Delete entry' }).first().click();
    await expect(saveAlert(page)).toContainText('Entry deleted');

    // Total should drop to zero
    await expect(page.getByTestId('total-hours')).toContainText('0h 0m');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 5. SYNC QUEUE
// ═════════════════════════════════════════════════════════════════════════════

test.describe('Timesheet: sync queue captures operations', () => {
  test.beforeEach(async ({ page }) => {
    await initApp(page);
  });

  test('editing a session writes an UPDATE entry to the opLog', async ({ page }) => {
    const session = makeSession({
      date: todayStr(),
      clockIn: localMs(todayStr(), 8, 0),
      clockOut: localMs(todayStr(), 9, 0),
      netWorkMs: 3_600_000,
      totalSessionMs: 3_600_000,
    });
    await seedWorkSession(page, session);

    const beforeCount = (await getOpLogEntries(page)).filter(
      (e) => e.operation === 'UPDATE' && e.collection === 'workSessions',
    ).length;

    await gotoTimesheet(page);
    await clickEditOnCard(page, 'Session Ended');
    await mobileList(page).getByPlaceholder('TKT-123').fill('SYNC-UPDATE');
    await page.getByRole('button', { name: /Save/ }).click();
    await expect(saveAlert(page)).toContainText('Entry saved');

    const afterEntries = await getOpLogEntries(page);
    const afterCount = afterEntries.filter(
      (e) => e.operation === 'UPDATE' && e.collection === 'workSessions',
    ).length;

    expect(afterCount).toBeGreaterThan(beforeCount);
  });

  test('creating a new session writes a CREATE entry to the opLog', async ({ page }) => {
    const beforeCount = (await getOpLogEntries(page)).filter(
      (e) => e.operation === 'CREATE' && e.collection === 'workSessions',
    ).length;

    await gotoTimesheet(page);
    await page.getByRole('button', { name: 'Add timesheet entry' }).click();
    await page.getByLabel('Start').fill('04:00');
    await page.getByLabel('End').fill('05:00');
    await mobileList(page).getByPlaceholder('TKT-123').fill('SYNC-CREATE');
    await page.getByRole('button', { name: /Save/ }).click();
    await expect(saveAlert(page)).toContainText('Entry saved');

    const afterEntries = await getOpLogEntries(page);
    const afterCount = afterEntries.filter(
      (e) => e.operation === 'CREATE' && e.collection === 'workSessions',
    ).length;

    expect(afterCount).toBeGreaterThan(beforeCount);
  });

  test('deleting a session writes a DELETE entry to the opLog', async ({ page }) => {
    const session = makeSession({
      date: todayStr(),
      clockIn: localMs(todayStr(), 7, 0),
      clockOut: localMs(todayStr(), 7, 30),
      netWorkMs: 1_800_000,
      totalSessionMs: 1_800_000,
    });
    await seedWorkSession(page, session);

    const beforeCount = (await getOpLogEntries(page)).filter(
      (e) => e.operation === 'DELETE' && e.collection === 'workSessions',
    ).length;

    await gotoTimesheet(page);
    await page.getByRole('button', { name: 'Delete entry' }).first().click();
    await expect(saveAlert(page)).toContainText('Entry deleted');

    const afterEntries = await getOpLogEntries(page);
    const afterCount = afterEntries.filter(
      (e) => e.operation === 'DELETE' && e.collection === 'workSessions',
    ).length;

    expect(afterCount).toBeGreaterThan(beforeCount);
  });

  test('sync queue UI shows the UPDATE entry for workSessions', async ({ page }) => {
    const session = makeSession({
      date: todayStr(),
      clockIn: localMs(todayStr(), 8, 0),
      clockOut: localMs(todayStr(), 9, 0),
      netWorkMs: 3_600_000,
      totalSessionMs: 3_600_000,
    });
    await seedWorkSession(page, session);

    await gotoTimesheet(page);
    await clickEditOnCard(page, 'Session Ended');
    await mobileList(page).getByPlaceholder('TKT-123').fill('UI-SYNC-CHECK');
    await page.getByRole('button', { name: /Save/ }).click();
    await expect(saveAlert(page)).toContainText('Entry saved');

    // Navigate to the Sync & Logs page
    await page.goto('/dashboard/oplogs');
    await page.waitForLoadState('networkidle');

    // Sync Queue tab is shown by default — look for the pending UPDATE on workSessions
    await expect(page.getByText('UPDATE', { exact: true })).toBeVisible();
    await expect(page.getByText('workSessions')).toBeVisible();
  });

  test('sync queue UI shows the CREATE entry after adding a new entry', async ({ page }) => {
    await gotoTimesheet(page);
    await page.getByRole('button', { name: 'Add timesheet entry' }).click();
    await page.getByLabel('Start').fill('03:00');
    await page.getByLabel('End').fill('04:00');
    await mobileList(page).getByPlaceholder('TKT-123').fill('UI-CREATE-CHECK');
    await page.getByRole('button', { name: /Save/ }).click();
    await expect(saveAlert(page)).toContainText('Entry saved');

    await page.goto('/dashboard/oplogs');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('CREATE', { exact: true })).toBeVisible();
    await expect(page.getByText('workSessions')).toBeVisible();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 6. DATE RANGE FILTERS
// ═════════════════════════════════════════════════════════════════════════════

test.describe('Timesheet: date range filter presets', () => {
  test.beforeEach(async ({ page }) => {
    await initApp(page);
  });

  test('Today preset shows today entries and excludes yesterday', async ({ page }) => {
    const todaySession = makeSession({
      date: todayStr(),
      clockIn: localMs(todayStr(), 8, 0),
      clockOut: localMs(todayStr(), 9, 0),
      netWorkMs: 3_600_000,
      totalSessionMs: 3_600_000,
    });
    const yesterdaySession = makeSession({
      date: yesterdayStr(),
      clockIn: localMs(yesterdayStr(), 8, 0),
      clockOut: localMs(yesterdayStr(), 9, 0),
      netWorkMs: 3_600_000,
      totalSessionMs: 3_600_000,
    });
    await seedWorkSession(page, todaySession);
    await seedWorkSession(page, yesterdaySession);

    await gotoTimesheet(page);
    // Default is the "Today" preset

    // Today's day header should be visible
    const todayDT = new Date(`${todayStr()}T12:00:00`);
    const todayDayName = todayDT.toLocaleDateString('en-US', { weekday: 'long' });
    await expect(page.getByText(todayDayName)).toBeVisible();

    // Yesterday's full date should NOT appear in the list body
    // (Use Luxon-style format: "Apr 27, 2026")
    const yestDT = new Date(`${yesterdayStr()}T12:00:00`);
    const yestFullDate = yestDT.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    await expect(page.getByText(yestFullDate)).not.toBeVisible();
  });

  test('Yesterday preset shows yesterday entries', async ({ page }) => {
    const yesterdaySession = makeSession({
      date: yesterdayStr(),
      clockIn: localMs(yesterdayStr(), 10, 0),
      clockOut: localMs(yesterdayStr(), 11, 0),
      netWorkMs: 3_600_000,
      totalSessionMs: 3_600_000,
      manualTicket: 'YEST-100',
    });
    await seedWorkSession(page, yesterdaySession);

    await gotoTimesheet(page);
    // Tap the "Yesterday" preset chip
    await page.getByRole('button', { name: 'Yesterday' }).click();
    await page.waitForTimeout(500);

    const yestDT = new Date(`${yesterdayStr()}T12:00:00`);
    const yestDayName = yestDT.toLocaleDateString('en-US', { weekday: 'long' });
    await expect(page.getByText(yestDayName)).toBeVisible();
    await expect(mobileList(page).getByText('YEST-100').first()).toBeVisible();
  });

  test('Past Week preset (last 7 days) includes an entry seeded 3 days ago', async ({ page }) => {
    const threeDaysAgo = daysAgoStr(3);
    const session = makeSession({
      date: threeDaysAgo,
      clockIn: localMs(threeDaysAgo, 9, 0),
      clockOut: localMs(threeDaysAgo, 10, 0),
      netWorkMs: 3_600_000,
      totalSessionMs: 3_600_000,
      manualTicket: 'WEEK-TEST',
    });
    await seedWorkSession(page, session);

    await gotoTimesheet(page);
    await page.getByRole('button', { name: 'Past Week' }).click();
    await page.waitForTimeout(500);

    const dt = new Date(`${threeDaysAgo}T12:00:00`);
    const dayName = dt.toLocaleDateString('en-US', { weekday: 'long' });
    await expect(page.getByText(dayName)).toBeVisible();
    await expect(mobileList(page).getByText('WEEK-TEST').first()).toBeVisible();
  });

  test('Past Month preset (last 30 days) includes an entry seeded 21 days ago', async ({ page }) => {
    const threeWeeksAgo = daysAgoStr(21);
    const session = makeSession({
      date: threeWeeksAgo,
      clockIn: localMs(threeWeeksAgo, 9, 0),
      clockOut: localMs(threeWeeksAgo, 10, 0),
      netWorkMs: 3_600_000,
      totalSessionMs: 3_600_000,
      manualTicket: 'MONTH-TEST',
    });
    await seedWorkSession(page, session);

    await gotoTimesheet(page);
    await page.getByRole('button', { name: 'Past Month' }).click();
    await page.waitForTimeout(500);

    await expect(mobileList(page).getByText('MONTH-TEST').first()).toBeVisible();
  });

  test('switching from Yesterday back to Today hides yesterday entries', async ({ page }) => {
    const todaySession = makeSession({
      date: todayStr(),
      clockIn: localMs(todayStr(), 8, 0),
      clockOut: localMs(todayStr(), 9, 0),
      netWorkMs: 3_600_000,
      totalSessionMs: 3_600_000,
      manualTicket: 'TODAY-FILTER',
    });
    const yesterdaySession = makeSession({
      date: yesterdayStr(),
      clockIn: localMs(yesterdayStr(), 8, 0),
      clockOut: localMs(yesterdayStr(), 9, 0),
      netWorkMs: 3_600_000,
      totalSessionMs: 3_600_000,
      manualTicket: 'YEST-FILTER',
    });
    await seedWorkSession(page, todaySession);
    await seedWorkSession(page, yesterdaySession);

    await gotoTimesheet(page);

    // Switch to Yesterday — should show YEST-FILTER
    await page.getByRole('button', { name: 'Yesterday' }).click();
    await page.waitForTimeout(500);
    await expect(mobileList(page).getByText('YEST-FILTER').first()).toBeVisible();
    await expect(page.getByText('TODAY-FILTER')).not.toBeVisible();

    // Switch back to Today — should show TODAY-FILTER
    await page.getByRole('button', { name: 'Today' }).click();
    await page.waitForTimeout(500);
    await expect(mobileList(page).getByText('TODAY-FILTER').first()).toBeVisible();
    await expect(page.getByText('YEST-FILTER')).not.toBeVisible();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 7. PAST DATE ENTRY
// ═════════════════════════════════════════════════════════════════════════════

test.describe('Timesheet: adding and editing entries for past dates', () => {
  test.beforeEach(async ({ page }) => {
    await initApp(page);
  });

  test('date input appears in day header when entry is in edit mode', async ({ page }) => {
    const session = makeSession({
      date: todayStr(),
      clockIn: localMs(todayStr(), 8, 0),
      clockOut: localMs(todayStr(), 9, 0),
      netWorkMs: 3_600_000,
      totalSessionMs: 3_600_000,
    });
    await seedWorkSession(page, session);
    await gotoTimesheet(page);

    await clickEditOnCard(page, 'Session Ended');

    await expect(page.getByLabel('Entry date')).toBeVisible();
  });

  test('date input pre-fills with the entry current date', async ({ page }) => {
    const session = makeSession({
      date: yesterdayStr(),
      clockIn: localMs(yesterdayStr(), 8, 0),
      clockOut: localMs(yesterdayStr(), 9, 0),
      netWorkMs: 3_600_000,
      totalSessionMs: 3_600_000,
    });
    await seedWorkSession(page, session);

    await gotoTimesheet(page);
    await page.getByRole('button', { name: 'Yesterday' }).click();
    await page.waitForTimeout(500);

    await clickEditOnCard(page, 'Session Ended');

    await expect(page.getByLabel('Entry date')).toHaveValue(yesterdayStr());
  });

  test('can create a new entry for yesterday via the date field', async ({ page }) => {
    await gotoTimesheet(page);
    // Switch to Past Week so both today and yesterday are visible after save
    await page.getByRole('button', { name: 'Past Week' }).click();
    await page.waitForTimeout(500);

    await page.getByRole('button', { name: 'Add timesheet entry' }).click();

    // Change date to yesterday in the day header date input
    await page.getByLabel('Entry date').fill(yesterdayStr());
    await page.getByLabel('Start').fill('09:00');
    await page.getByLabel('End').fill('10:00');
    await mobileList(page).getByPlaceholder('TKT-123').fill('PAST-DATE-001');
    await page.getByRole('button', { name: /Save/ }).click();

    await expect(saveAlert(page)).toContainText('Entry saved');

    // Entry should appear under yesterday's day group — expand it first
    const yestDT = new Date(`${yesterdayStr()}T12:00:00`);
    const yestDayName = yestDT.toLocaleDateString('en-US', { weekday: 'long' });
    const yestHeader = page.locator('button').filter({ hasText: yestDayName }).first();
    await expect(yestHeader).toBeVisible();
    await yestHeader.click();
    await expect(mobileList(page).getByText('PAST-DATE-001').first()).toBeVisible();
  });

  test('new entry for past date persists in IndexedDB with correct date', async ({ page }) => {
    await gotoTimesheet(page);
    await page.getByRole('button', { name: 'Past Week' }).click();
    await page.waitForTimeout(500);

    await page.getByRole('button', { name: 'Add timesheet entry' }).click();

    await page.getByLabel('Entry date').fill(yesterdayStr());
    await page.getByLabel('Start').fill('08:00');
    await page.getByLabel('End').fill('08:30');
    await mobileList(page).getByPlaceholder('TKT-123').fill('PAST-PERSIST-001');
    await page.getByRole('button', { name: /Save/ }).click();

    await expect(saveAlert(page)).toContainText('Entry saved');

    // Verify the stored session has yesterday's date
    const found = await page.evaluate(async (yest) => {
      const uuid = localStorage.getItem('th_identity_uuid');
      const dbName = uuid ? `TimeharborDB_${uuid}` : 'TimeharborDB';
      return new Promise<Record<string, unknown> | null>((resolve, reject) => {
        const req = indexedDB.open(dbName);
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('workSessions', 'readonly');
          const getAll = tx.objectStore('workSessions').getAll();
          getAll.onsuccess = () => {
            const match = (getAll.result as Record<string, unknown>[]).find(
              (s) => s.manualTicket === 'PAST-PERSIST-001',
            );
            resolve(match ?? null);
          };
          getAll.onerror = () => reject(getAll.error);
        };
      });
    }, yesterdayStr());

    expect(found).not.toBeNull();
    expect(found?.date).toBe(yesterdayStr());
  });

  test('can change the date of an existing entry to an earlier date', async ({ page }) => {
    const twoDaysAgo = daysAgoStr(2);
    const threeDaysAgo = daysAgoStr(3);

    const session = makeSession({
      date: twoDaysAgo,
      clockIn: localMs(twoDaysAgo, 10, 0),
      clockOut: localMs(twoDaysAgo, 11, 0),
      netWorkMs: 3_600_000,
      totalSessionMs: 3_600_000,
      manualTicket: 'MOVE-DATE-001',
    });
    await seedWorkSession(page, session);

    await gotoTimesheet(page);
    await page.getByRole('button', { name: 'Past Week' }).click();
    await page.waitForTimeout(500);

    await clickEditOnCard(page, 'Session Ended');
    await page.getByLabel('Entry date').fill(threeDaysAgo);
    await page.getByRole('button', { name: /Save/ }).click();

    await expect(saveAlert(page)).toContainText('Entry saved');

    // Entry should now appear under the three-days-ago group — expand it first
    const dt = new Date(`${threeDaysAgo}T12:00:00`);
    const dayName = dt.toLocaleDateString('en-US', { weekday: 'long' });
    const dayHeader = page.locator('button').filter({ hasText: dayName }).first();
    await expect(dayHeader).toBeVisible();
    await dayHeader.click();
    await expect(mobileList(page).getByText('MOVE-DATE-001').first()).toBeVisible();

    // Verify stored date in IndexedDB
    const updated = await getWorkSession(page, session.id as string);
    expect(updated?.date).toBe(threeDaysAgo);
  });
});
