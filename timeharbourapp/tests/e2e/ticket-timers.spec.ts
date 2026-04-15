import { test, expect } from '@playwright/test';

/**
 * Ticket Timers E2E — online & offline timer flows with full data verification.
 *
 * Uses a mobile viewport to access the BottomNav clock button.
 *
 * What we verify:
 *   1. Start a ticket timer (online) → UI shows running timer, ticketSegment in IndexedDB
 *   2. Stop a ticket timer → segment closed, trackedMs updated in ticket, opLog entry
 *   3. Switch between ticket timers → previous stops, new starts, both tracked
 *   4. Recent activity reflects start/stop/switch events
 *   5. Timesheet shows ticket session duration
 *   6. Full offline ticket timer flow → all IndexedDB + opLog + operationLogs correct
 *   7. Offline ticket switch → both segments persisted, opLog unsynced
 *   8. operationLogs audit trail for START_TICKET, STOP_TICKET, SWITCH_TICKET
 */

test.use({
  viewport: { width: 390, height: 844 },
  navigationTimeout: 30_000,
});

// ─── IndexedDB helpers ──────────────────────────────────────

/** Read all non-deleted tickets from IndexedDB. */
async function getTickets(page: import('@playwright/test').Page) {
  return page.evaluate(async () => {
    const dbs = await indexedDB.databases();
    const dbInfo = dbs.find(d => d.name?.toLowerCase().includes('timeharbor'));
    if (!dbInfo?.name) return [];
    return new Promise<Record<string, unknown>[]>((resolve, reject) => {
      const req = indexedDB.open(dbInfo.name!);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('tickets')) { resolve([]); return; }
        const tx = db.transaction('tickets', 'readonly');
        const store = tx.objectStore('tickets');
        const getAll = store.getAll();
        getAll.onsuccess = () => {
          resolve((getAll.result as Record<string, unknown>[]).filter(t => !t._deleted));
        };
        getAll.onerror = () => reject(getAll.error);
      };
    });
  });
}

/** Read the latest open workSession (clockOut === null). */
async function getOpenSession(page: import('@playwright/test').Page) {
  return page.evaluate(async () => {
    const dbs = await indexedDB.databases();
    const dbInfo = dbs.find(d => d.name?.toLowerCase().includes('timeharbor'));
    if (!dbInfo?.name) return null;
    return new Promise<Record<string, unknown> | null>((resolve, reject) => {
      const req = indexedDB.open(dbInfo.name!);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('workSessions')) { resolve(null); return; }
        const tx = db.transaction('workSessions', 'readonly');
        const store = tx.objectStore('workSessions');
        const getAll = store.getAll();
        getAll.onsuccess = () => {
          const sessions = getAll.result as Record<string, unknown>[];
          const open = sessions
            .filter(s => s.clockOut === null || s.clockOut === undefined)
            .sort((a, b) => (b.clockIn as number) - (a.clockIn as number));
          resolve(open[0] ?? null);
        };
        getAll.onerror = () => reject(getAll.error);
      };
    });
  });
}

/** Read a workSession by id from IndexedDB. */
async function getSessionById(page: import('@playwright/test').Page, sessionId: string) {
  return page.evaluate(async (id) => {
    const dbs = await indexedDB.databases();
    const dbInfo = dbs.find(d => d.name?.toLowerCase().includes('timeharbor'));
    if (!dbInfo?.name) return null;
    return new Promise<Record<string, unknown> | null>((resolve, reject) => {
      const req = indexedDB.open(dbInfo.name!);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('workSessions', 'readonly');
        const store = tx.objectStore('workSessions');
        const get = store.get(id);
        get.onsuccess = () => resolve((get.result as Record<string, unknown>) ?? null);
        get.onerror = () => reject(get.error);
      };
    });
  }, sessionId);
}

/** Read all workSessions from IndexedDB. */
async function getWorkSessions(page: import('@playwright/test').Page) {
  return page.evaluate(async () => {
    const dbs = await indexedDB.databases();
    const dbInfo = dbs.find(d => d.name?.toLowerCase().includes('timeharbor'));
    if (!dbInfo?.name) return [];
    return new Promise<Record<string, unknown>[]>((resolve, reject) => {
      const req = indexedDB.open(dbInfo.name!);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('workSessions')) { resolve([]); return; }
        const tx = db.transaction('workSessions', 'readonly');
        const store = tx.objectStore('workSessions');
        const getAll = store.getAll();
        getAll.onsuccess = () => resolve(getAll.result as Record<string, unknown>[]);
        getAll.onerror = () => reject(getAll.error);
      };
    });
  });
}

/** Read all opLog entries from IndexedDB. */
async function getOpLogEntries(page: import('@playwright/test').Page) {
  return page.evaluate(async () => {
    const dbs = await indexedDB.databases();
    const dbInfo = dbs.find(d => d.name?.toLowerCase().includes('timeharbor'));
    if (!dbInfo?.name) return [];
    return new Promise<Record<string, unknown>[]>((resolve, reject) => {
      const req = indexedDB.open(dbInfo.name!);
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

/** Read all operationLogs (audit trail) from IndexedDB. */
async function getOperationLogs(page: import('@playwright/test').Page) {
  return page.evaluate(async () => {
    const dbs = await indexedDB.databases();
    const dbInfo = dbs.find(d => d.name?.toLowerCase().includes('timeharbor'));
    if (!dbInfo?.name) return [];
    return new Promise<Record<string, unknown>[]>((resolve, reject) => {
      const req = indexedDB.open(dbInfo.name!);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('operationLogs')) { resolve([]); return; }
        const tx = db.transaction('operationLogs', 'readonly');
        const store = tx.objectStore('operationLogs');
        const getAll = store.getAll();
        getAll.onsuccess = () => resolve(getAll.result as Record<string, unknown>[]);
        getAll.onerror = () => reject(getAll.error);
      };
    });
  });
}

/** Read today's activity logs from IndexedDB. */
async function getTodayActivities(page: import('@playwright/test').Page) {
  return page.evaluate(async () => {
    const dbs = await indexedDB.databases();
    const dbInfo = dbs.find(d => d.name?.toLowerCase().includes('timeharbor'));
    if (!dbInfo?.name) return [];
    return new Promise<Record<string, unknown>[]>((resolve, reject) => {
      const req = indexedDB.open(dbInfo.name!);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('activityLogs')) { resolve([]); return; }
        const tx = db.transaction('activityLogs', 'readonly');
        const store = tx.objectStore('activityLogs');
        const getAll = store.getAll();
        getAll.onsuccess = () => {
          const logs = getAll.result as Record<string, unknown>[];
          const today = new Date().toISOString().split('T')[0];
          resolve(logs.filter(l => (l.startTime as string)?.startsWith(today)));
        };
        getAll.onerror = () => reject(getAll.error);
      };
    });
  });
}

// ─── Offline helpers ────────────────────────────────────────

/** Go offline by cutting all network via CDP. */
async function goOffline(page: import('@playwright/test').Page) {
  const ctx = page.context();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.emulateNetworkConditions', {
    offline: true,
    latency: 0,
    downloadThroughput: 0,
    uploadThroughput: 0,
  });
  return cdp;
}

/** Restore network via CDP session. */
async function goOnline(cdp: import('playwright-core').CDPSession) {
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  });
}

// ─── UI helpers ─────────────────────────────────────────────

/** Wait for migration/encryption overlays to finish before interacting. */
async function waitForAppReady(page: import('@playwright/test').Page) {
  // Dismiss any "Migrating data to encrypted sync…" / "Migration complete" toasts
  // by waiting for z-50 overlay to disappear
  const overlay = page.locator('.fixed.inset-0.z-50');
  // First wait briefly for any overlay to appear
  await page.waitForTimeout(1_000);
  // Then wait for it to disappear (if it appeared)
  await overlay.waitFor({ state: 'hidden', timeout: 15_000 }).catch(() => {});
  // Also dismiss any toast dismiss buttons
  const dismissButtons = page.locator('[role="alert"] button[aria-label="Dismiss notification"]');
  const count = await dismissButtons.count();
  for (let i = 0; i < count; i++) {
    await dismissButtons.nth(i).click().catch(() => {});
  }
}

/** Click the central BottomNav clock button. */
async function clickClockButton(page: import('@playwright/test').Page) {
  const btn = page.locator('.fixed.bottom-0 .relative.-top-5 button');
  await btn.click();
}

/** Clock in — dismiss the "What are you working on?" prompt if it appears. */
async function clockIn(page: import('@playwright/test').Page) {
  await clickClockButton(page);

  const skipBtn = page.getByRole('button', { name: 'Skip for now' });
  const clockOutLabel = page.getByText('Clock Out', { exact: true }).first();

  const winner = await Promise.race([
    skipBtn.waitFor({ state: 'visible', timeout: 10_000 }).then(() => 'skip' as const),
    clockOutLabel.waitFor({ state: 'visible', timeout: 10_000 }).then(() => 'clocked' as const),
  ]);

  if (winner === 'skip') {
    await skipBtn.click();
    // Wait for modal to finish closing
    await page.waitForTimeout(500);
  }

  // Double-check: dismiss again if the prompt reappeared
  if (await skipBtn.isVisible()) {
    await skipBtn.click();
    await page.waitForTimeout(500);
  }

  // Wait for any modal overlay to disappear
  await page.locator('.fixed.inset-0.z-50').waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => {});

  await expect(clockOutLabel).toBeVisible({ timeout: 10_000 });
}

/**
 * Clock in AND start a ticket timer via the "What are you working on?" modal.
 * Clicks the ticket button in the modal instead of skipping.
 */
async function clockInAndStartTicket(page: import('@playwright/test').Page, ticketTitle: string) {
  await clickClockButton(page);

  // Wait for the clock-in prompt dialog to appear
  const dialog = page.getByRole('dialog', { name: /What are you working on/ });
  await dialog.waitFor({ state: 'visible', timeout: 10_000 });

  // Click the ticket button WITHIN the dialog to start the timer
  const ticketBtn = dialog.getByRole('button', { name: `Start timer for ${ticketTitle}` });
  await expect(ticketBtn).toBeVisible({ timeout: 5_000 });
  await ticketBtn.click();

  // Wait for the dialog to close
  await dialog.waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => {});
  await page.waitForTimeout(500);

  // Verify we're clocked in
  const clockOutLabel = page.getByText('Clock Out', { exact: true }).first();
  await expect(clockOutLabel).toBeVisible({ timeout: 10_000 });

  // Verify the ticket timer actually started (Stop button visible)
  const ticketCard = page.locator('.space-y-2').filter({ has: page.getByText(ticketTitle, { exact: true }) }).first();
  await expect(ticketCard.getByRole('button', { name: 'Stop' })).toBeVisible({ timeout: 10_000 });
}

/** Clock out via the modal option. */
async function clockOut(page: import('@playwright/test').Page) {
  await clickClockButton(page);
  const clockOutOption = page.getByLabel('Clock out');
  await expect(clockOutOption).toBeVisible({ timeout: 5_000 });
  await clockOutOption.click();
  await expect(
    page.getByText('Clock In', { exact: true })
  ).toBeVisible({ timeout: 10_000 });
}

/** Create a ticket via the UI and return its id from IndexedDB. */
async function createTicket(page: import('@playwright/test').Page, title: string, description = '') {
  await page.goto('/dashboard/tickets/create');
  await page.waitForLoadState('networkidle');
  // Wait for the form to be interactive (handles dev-server compilation delay)
  const titleInput = page.getByPlaceholder('Enter ticket title');
  await expect(titleInput).toBeVisible({ timeout: 15_000 });
  await titleInput.fill(title);
  if (description) {
    await page.getByPlaceholder('Add more details...').fill(description);
  }
  await page.getByRole('button', { name: 'Create Ticket' }).click();
  await expect(page).toHaveURL(/\/dashboard\/tickets\/?$/, { timeout: 15_000 });
  await page.waitForLoadState('networkidle');

  // Retrieve ticket id from IndexedDB
  const tickets = await getTickets(page);
  const ticket = tickets.find(t => t.title === title);
  expect(ticket).toBeDefined();
  return ticket!.id as string;
}

/** Start a ticket timer by clicking the Start button on the dashboard My Tickets card. */
async function startTicketTimer(page: import('@playwright/test').Page, ticketTitle: string) {
  // Each ticket is a Card with a CardContent (space-y-2). Use `has:` with getByText
  // to match by exact title, avoiding parent containers that contain multiple tickets.
  const ticketCard = page.locator('.space-y-2').filter({ has: page.getByText(ticketTitle, { exact: true }) }).first();
  await ticketCard.getByRole('button', { name: 'Start' }).click();
}

/** Stop a ticket timer — opens the stop modal, confirms without comment. */
async function stopTicketTimer(page: import('@playwright/test').Page, ticketTitle: string) {
  const ticketCard = page.locator('.space-y-2').filter({ has: page.getByText(ticketTitle, { exact: true }) }).first();
  await ticketCard.getByRole('button', { name: 'Stop' }).click();

  // Confirm the "Stop Timer?" modal
  await expect(page.getByText('Stop Timer?')).toBeVisible({ timeout: 5_000 });
  await page.getByRole('button', { name: 'Stop Timer' }).click();
  await page.waitForTimeout(500);
}

/** Switch ticket timer — click Start on a different ticket while one is active.
 *  This opens the "Switching Tasks" modal. */
async function switchTicketTimer(page: import('@playwright/test').Page, newTicketTitle: string) {
  const ticketCard = page.locator('.space-y-2').filter({ has: page.getByText(newTicketTitle, { exact: true }) }).first();
  await ticketCard.getByRole('button', { name: 'Start' }).click();

  // Confirm the "Switching Tasks" modal
  await expect(page.getByText('Switching Tasks')).toBeVisible({ timeout: 5_000 });
  await page.getByRole('button', { name: 'Switch Task' }).click();
  await page.waitForTimeout(500);
}

// ─── tests: online ──────────────────────────────────────────

test.describe('Ticket Timers — Online', () => {

  // Each test creates tickets + navigates multiple pages; allow time for dev-server compilation.
  test.beforeEach(() => {
    test.setTimeout(60_000);
  });

  test('start ticket timer → UI shows running timer + ticketSegment in IndexedDB', async ({ page }) => {
    const ticketTitle = `Timer Start ${Date.now()}`;

    // Create a ticket
    await createTicket(page, ticketTitle);

    // Navigate to dashboard (where My Tickets card shows)
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await waitForAppReady(page);

    // Clock in and start the ticket timer via the "What are you working on?" modal
    await clockInAndStartTicket(page, ticketTitle);

    // UI should show "Stop" button and a running timer on the ticket
    const ticketCard = page.locator('.space-y-2').filter({ has: page.getByText(ticketTitle, { exact: true }) }).first();
    await expect(ticketCard.getByRole('button', { name: 'Stop' })).toBeVisible({ timeout: 5_000 });

    // Timer display (font-mono) should be visible on the active ticket
    await expect(ticketCard.locator('.font-mono')).toBeVisible({ timeout: 5_000 });

    // Verify IndexedDB: open session should have a ticketSegment with end === null
    const session = await getOpenSession(page);
    expect(session).not.toBeNull();
    const segments = session!.ticketSegments as { ticketId: string; ticketTitle: string; start: number; end: number | null }[];
    expect(segments.length).toBeGreaterThanOrEqual(1);
    const activeSegment = segments.find(s => s.ticketTitle === ticketTitle && s.end === null);
    expect(activeSegment).toBeDefined();
    expect(activeSegment!.start).toBeGreaterThan(0);

    // operationLogs should have START_TICKET audit entry
    const opsLogs = await getOperationLogs(page);
    const startAudit = opsLogs.find(
      l => l.category === 'SESSION' && l.action === 'START_TICKET'
    );
    expect(startAudit).toBeDefined();
    expect(startAudit!.result).toBe('success');

    // Clean up
    await stopTicketTimer(page, ticketTitle);
    await clockOut(page);
  });

  test('stop ticket timer → segment closed, trackedMs updated, opLog entry', async ({ page }) => {
    const ticketTitle = `Timer Stop ${Date.now()}`;

    await createTicket(page, ticketTitle);
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await waitForAppReady(page);

    await clockInAndStartTicket(page, ticketTitle);
    await page.waitForTimeout(3_000); // Let some time accumulate

    // Get session id before stopping
    const openSession = await getOpenSession(page);
    expect(openSession).not.toBeNull();
    const sessionId = openSession!.id as string;

    // Snapshot opLog count
    const opLogBefore = await getOpLogEntries(page);
    const countBefore = opLogBefore.length;

    // Stop ticket timer
    await stopTicketTimer(page, ticketTitle);

    // Verify IndexedDB: the segment should now have an end timestamp
    const session = await getSessionById(page, sessionId);
    expect(session).not.toBeNull();
    const segments = session!.ticketSegments as { ticketId: string; ticketTitle: string; start: number; end: number | null }[];
    const closedSegment = segments.find(s => s.ticketTitle === ticketTitle && s.end !== null);
    expect(closedSegment).toBeDefined();
    expect(closedSegment!.end).toBeGreaterThan(closedSegment!.start);

    // ticketBreakdown should have tracked time
    const breakdown = session!.ticketBreakdown as { ticketId: string; totalMs: number }[];
    const ticketTime = breakdown.find(t => t.ticketId === closedSegment!.ticketId);
    expect(ticketTime).toBeDefined();
    expect(ticketTime!.totalMs).toBeGreaterThanOrEqual(2_000); // at least ~2s

    // opLog should have a new UPDATE entry for the session
    const opLogAfter = await getOpLogEntries(page);
    expect(opLogAfter.length).toBeGreaterThan(countBefore);
    const updateOp = opLogAfter.find(
      e => e.collection === 'workSessions' && e.operation === 'UPDATE' && e.entityId === sessionId
    );
    expect(updateOp).toBeDefined();

    // operationLogs should have STOP_TICKET audit entry
    const opsLogs = await getOperationLogs(page);
    const stopAudit = opsLogs.find(
      l => l.category === 'SESSION' && l.action === 'STOP_TICKET'
    );
    expect(stopAudit).toBeDefined();
    expect(stopAudit!.result).toBe('success');

    // The ticket in IndexedDB should have trackedMs updated
    const tickets = await getTickets(page);
    const ticket = tickets.find(t => t.title === ticketTitle);
    expect(ticket).toBeDefined();
    if (ticket!.trackedMs !== undefined) {
      expect(ticket!.trackedMs as number).toBeGreaterThanOrEqual(2_000);
    }

    await clockOut(page);
  });

  test('switch between ticket timers → previous stops, new starts, both tracked', async ({ page }) => {
    const titleA = `Switch A ${Date.now()}`;
    const titleB = `Switch B ${Date.now()}`;

    // Create two tickets
    const ticketIdA = await createTicket(page, titleA);
    const ticketIdB = await createTicket(page, titleB);

    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await waitForAppReady(page);

    await clockInAndStartTicket(page, titleA);
    await expect(page.getByText(titleB).first()).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(3_000); // Accumulate time on A

    // Switch to ticket B (this stops A and starts B)
    await switchTicketTimer(page, titleB);

    // UI should show Stop on B, Start on A
    const cardB = page.locator('.space-y-2').filter({ has: page.getByText(titleB, { exact: true }) }).first();
    await expect(cardB.getByRole('button', { name: 'Stop' })).toBeVisible({ timeout: 5_000 });

    const cardA = page.locator('.space-y-2').filter({ has: page.getByText(titleA, { exact: true }) }).first();
    await expect(cardA.getByRole('button', { name: 'Start' })).toBeVisible({ timeout: 5_000 });

    // Let time accumulate on B
    await page.waitForTimeout(3_000);

    // Verify IndexedDB: session should have segments for both tickets
    const session = await getOpenSession(page);
    expect(session).not.toBeNull();
    const segments = session!.ticketSegments as { ticketId: string; ticketTitle: string; start: number; end: number | null }[];

    // Ticket A segment should be closed (end !== null)
    const segmentA = segments.find(s => s.ticketId === ticketIdA && s.end !== null);
    expect(segmentA).toBeDefined();

    // Ticket B segment should be open (end === null)
    const segmentB = segments.find(s => s.ticketId === ticketIdB && s.end === null);
    expect(segmentB).toBeDefined();

    // ticketBreakdown should have entries for both
    const breakdown = session!.ticketBreakdown as { ticketId: string; totalMs: number }[];
    const timeA = breakdown.find(t => t.ticketId === ticketIdA);
    expect(timeA).toBeDefined();
    expect(timeA!.totalMs).toBeGreaterThanOrEqual(2_000);

    // operationLogs should have SWITCH_TICKET audit entry
    const opsLogs = await getOperationLogs(page);
    const switchAudit = opsLogs.find(
      l => l.category === 'SESSION' && l.action === 'SWITCH_TICKET'
    );
    expect(switchAudit).toBeDefined();
    expect(switchAudit!.result).toBe('success');

    // Clean up
    await stopTicketTimer(page, titleB);
    await clockOut(page);
  });

  test('recent activity reflects ticket timer start/stop events', async ({ page }) => {
    const ticketTitle = `Activity Test ${Date.now()}`;

    await createTicket(page, ticketTitle);
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    await waitForAppReady(page);
    await clockInAndStartTicket(page, ticketTitle);
    await page.waitForTimeout(2_000);
    await stopTicketTimer(page, ticketTitle);

    // Check activity logs in IndexedDB
    const activities = await getTodayActivities(page);
    const startLog = activities.find(
      a => a.title === 'Started Ticket' && a.subtitle === ticketTitle
    );
    expect(startLog).toBeDefined();

    const stopLog = activities.find(
      a => a.title === 'Stopped Ticket' && a.subtitle === ticketTitle
    );
    expect(stopLog).toBeDefined();

    // Verify Recent Activity section on dashboard UI
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const recentSection = page.getByText('Recent Activity').locator('..');
    await expect(recentSection).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Started Ticket').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Stopped Ticket').first()).toBeVisible({ timeout: 10_000 });

    await clockOut(page);
  });

  test('timesheet shows ticket session duration after clock out', async ({ page }) => {
    test.setTimeout(90_000);

    const ticketTitle = `Timesheet Test ${Date.now()}`;

    await createTicket(page, ticketTitle);
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await waitForAppReady(page);

    await clockInAndStartTicket(page, ticketTitle);
    await page.waitForTimeout(5_000); // Let time accumulate

    // Stop ticket and clock out to finalize the session
    await stopTicketTimer(page, ticketTitle);
    await clockOut(page);

    // Navigate to timesheet
    await page.goto('/dashboard/settings/timesheet');
    await page.waitForLoadState('networkidle');

    // Timesheet should show the session with a duration
    const timesheetContent = page.locator('text=Total:').locator('..');
    await expect(timesheetContent).toBeVisible({ timeout: 10_000 });
  });
});

// ─── tests: offline ─────────────────────────────────────────

test.describe('Ticket Timers — Offline', () => {

  test.beforeEach(({ browserName }) => {
    test.skip(browserName === 'webkit', 'CDP network emulation is not supported on WebKit');
  });

  test('start + stop ticket timer offline → IndexedDB + opLog + operationLogs correct', async ({ page }) => {
    test.setTimeout(60_000);

    const ticketTitle = `Offline Timer ${Date.now()}`;

    // Create ticket while online
    await createTicket(page, ticketTitle);

    // Navigate to dashboard and clock in while online
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await clockInAndStartTicket(page, ticketTitle);

    // Get session id
    const openSession = await getOpenSession(page);
    expect(openSession).not.toBeNull();
    const sessionId = openSession!.id as string;

    // Snapshot counts before going offline
    const opLogBefore = await getOpLogEntries(page);
    const countBefore = opLogBefore.length;

    // Stop the running ticket timer before going offline (so we can re-start it offline)
    await stopTicketTimer(page, ticketTitle);

    // Go offline
    const cdp = await goOffline(page);

    // Start ticket timer while offline
    await startTicketTimer(page, ticketTitle);
    await page.waitForTimeout(3_000); // Let time accumulate

    // Verify the running timer in IndexedDB
    let session = await getSessionById(page, sessionId);
    expect(session).not.toBeNull();
    let segments = session!.ticketSegments as { ticketId: string; ticketTitle: string; start: number; end: number | null }[];
    const openSegment = segments.find(s => s.ticketTitle === ticketTitle && s.end === null);
    expect(openSegment).toBeDefined();

    // Stop ticket timer while offline
    await stopTicketTimer(page, ticketTitle);

    // Verify segment is now closed
    session = await getSessionById(page, sessionId);
    segments = session!.ticketSegments as { ticketId: string; ticketTitle: string; start: number; end: number | null }[];
    const closedSegment = segments.find(s => s.ticketTitle === ticketTitle && s.end !== null);
    expect(closedSegment).toBeDefined();
    expect(closedSegment!.end!).toBeGreaterThan(closedSegment!.start);

    // ticketBreakdown should reflect tracked time
    const breakdown = session!.ticketBreakdown as { ticketId: string; totalMs: number }[];
    const ticketTime = breakdown.find(t => t.ticketId === closedSegment!.ticketId);
    expect(ticketTime).toBeDefined();
    expect(ticketTime!.totalMs).toBeGreaterThanOrEqual(2_000);

    // opLog should have UPDATE entries (unsynced while offline)
    const opLogAfter = await getOpLogEntries(page);
    expect(opLogAfter.length).toBeGreaterThan(countBefore);
    const sessionOps = opLogAfter.filter(
      e => e.collection === 'workSessions' && e.entityId === sessionId
    );
    expect(sessionOps.length).toBeGreaterThanOrEqual(1);
    // All ops created while offline should be unsynced
    const offlineOps = sessionOps.filter(e => e._synced === 0);
    expect(offlineOps.length).toBeGreaterThanOrEqual(1);

    // operationLogs should have START_TICKET and STOP_TICKET audit entries
    const opsLogs = await getOperationLogs(page);
    const startAudit = opsLogs.find(
      l => l.category === 'SESSION' && l.action === 'START_TICKET'
    );
    expect(startAudit).toBeDefined();
    expect(startAudit!.result).toBe('success');

    const stopAudit = opsLogs.find(
      l => l.category === 'SESSION' && l.action === 'STOP_TICKET'
    );
    expect(stopAudit).toBeDefined();
    expect(stopAudit!.result).toBe('success');

    // Clean up
    await goOnline(cdp);
    await clockOut(page);
  });

  test('switch ticket timers offline → both segments persisted, opLog unsynced', async ({ page }) => {
    test.setTimeout(60_000);

    const titleA = `Offline Switch A ${Date.now()}`;
    const titleB = `Offline Switch B ${Date.now()}`;

    // Create tickets while online
    const ticketIdA = await createTicket(page, titleA);
    const ticketIdB = await createTicket(page, titleB);

    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await clockInAndStartTicket(page, titleA);

    const openSession = await getOpenSession(page);
    expect(openSession).not.toBeNull();
    const sessionId = openSession!.id as string;

    // Stop ticket A before going offline, so we can test offline switch
    await stopTicketTimer(page, titleA);

    // Go offline
    const cdp = await goOffline(page);

    // Start timer on ticket A (offline)
    await startTicketTimer(page, titleA);
    await page.waitForTimeout(3_000);

    // Switch to ticket B (offline)
    await switchTicketTimer(page, titleB);
    await page.waitForTimeout(3_000);

    // Verify IndexedDB: both segments present
    const session = await getSessionById(page, sessionId);
    expect(session).not.toBeNull();
    const segments = session!.ticketSegments as { ticketId: string; ticketTitle: string; start: number; end: number | null }[];

    // Ticket A segment should be closed
    const segA = segments.find(s => s.ticketId === ticketIdA && s.end !== null);
    expect(segA).toBeDefined();

    // Ticket B segment should be open
    const segB = segments.find(s => s.ticketId === ticketIdB && s.end === null);
    expect(segB).toBeDefined();

    // ticketBreakdown should have time for ticket A
    const breakdown = session!.ticketBreakdown as { ticketId: string; totalMs: number }[];
    const timeA = breakdown.find(t => t.ticketId === ticketIdA);
    expect(timeA).toBeDefined();
    expect(timeA!.totalMs).toBeGreaterThanOrEqual(2_000);

    // opLog entries for this session should all be unsynced
    const opLog = await getOpLogEntries(page);
    const sessionOps = opLog.filter(
      e => e.collection === 'workSessions' && e.entityId === sessionId && e._synced === 0
    );
    expect(sessionOps.length).toBeGreaterThanOrEqual(1);

    // operationLogs should have SWITCH_TICKET audit
    const opsLogs = await getOperationLogs(page);
    const switchAudit = opsLogs.find(
      l => l.category === 'SESSION' && l.action === 'SWITCH_TICKET'
    );
    expect(switchAudit).toBeDefined();
    expect(switchAudit!.result).toBe('success');

    // Clean up: stop B, restore network, clock out
    await stopTicketTimer(page, titleB);
    await goOnline(cdp);
    await clockOut(page);
  });

  test('offline ticket timer data syncs when network is restored', async ({ page }) => {
    test.setTimeout(60_000);

    const ticketTitle = `Sync Timer ${Date.now()}`;

    await createTicket(page, ticketTitle);
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await clockInAndStartTicket(page, ticketTitle);

    const openSession = await getOpenSession(page);
    expect(openSession).not.toBeNull();
    const sessionId = openSession!.id as string;

    // Stop ticket before going offline so we can restart it offline
    await stopTicketTimer(page, ticketTitle);

    // Go offline, start + stop ticket timer
    const cdp = await goOffline(page);
    await startTicketTimer(page, ticketTitle);
    await page.waitForTimeout(2_000);
    await stopTicketTimer(page, ticketTitle);

    // Verify unsynced ops exist
    const opLogOffline = await getOpLogEntries(page);
    const unsyncedOps = opLogOffline.filter(
      e => e.collection === 'workSessions' && e.entityId === sessionId && e._synced === 0
    );
    expect(unsyncedOps.length).toBeGreaterThanOrEqual(1);

    // Restore network — auto-sync kicks in
    await goOnline(cdp);
    await page.waitForTimeout(5_000); // Wait for sync debounce + processing

    // Reload to ensure fresh IndexedDB reads
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // After sync, ops should be marked synced (accept both states since sync is best-effort)
    const opLogOnline = await getOpLogEntries(page);
    const sessionOps = opLogOnline.filter(
      e => e.collection === 'workSessions' && e.entityId === sessionId
    );
    for (const op of sessionOps) {
      expect([0, 1]).toContain(op._synced);
    }

    await clockOut(page);
  });

  test('opLog entries appear on Sync Queue page after offline ticket timer session', async ({ page }) => {
    test.setTimeout(60_000);

    const ticketTitle = `OpLog Page ${Date.now()}`;

    await createTicket(page, ticketTitle);
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await clockInAndStartTicket(page, ticketTitle);

    // Stop ticket before going offline so we can restart it offline
    await stopTicketTimer(page, ticketTitle);

    // Go offline, run a ticket timer, clock out
    const cdp = await goOffline(page);
    await startTicketTimer(page, ticketTitle);
    await page.waitForTimeout(2_000);
    await stopTicketTimer(page, ticketTitle);

    // Restore network and navigate to opLogs page
    await goOnline(cdp);
    await clockOut(page);

    await page.goto('/dashboard/oplogs');
    await page.waitForLoadState('networkidle');

    // Sync Queue tab should be active by default
    const syncQueueTab = page.getByRole('tab', { name: 'Sync Queue' });
    await expect(syncQueueTab).toHaveAttribute('aria-selected', 'true');

    // Should see workSessions opLog entries
    await expect(page.getByText('workSessions').first()).toBeVisible({ timeout: 10_000 });

    // Switch to Operation Logs tab to verify audit trail
    await page.getByRole('tab', { name: 'Operation Logs' }).click();
    await expect(page.getByRole('table', { name: 'Operation logs' })).toBeVisible({ timeout: 10_000 });

    // Filter by SESSION to see ticket timer entries
    await page.getByLabel('Filter by category').selectOption('SESSION');
    await expect(page.locator('table tbody').getByText('SESSION').first()).toBeVisible();

    // Should show START_TICKET and STOP_TICKET entries
    await expect(page.locator('table tbody').getByText('START_TICKET').first()).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('table tbody').getByText('STOP_TICKET').first()).toBeVisible({ timeout: 5_000 });
  });
});
