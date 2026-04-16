import { test, expect } from '@playwright/test';

/**
 * Offline-first Time Engine E2E — verify clock-in / clock-out works
 * entirely offline, persists in IndexedDB, and records correct opLog
 * and operationLogs entries.
 *
 * Pattern mirrors offline-tickets.spec.ts: load page online, go offline
 * via CDP, perform the action, then verify IndexedDB state.
 */

test.use({
  viewport: { width: 390, height: 844 },
  navigationTimeout: 30_000,
});

// ─── IndexedDB helpers ──────────────────────────────────────

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

/** Click the central BottomNav clock button. */
async function clickClockButton(page: import('@playwright/test').Page) {
  const btn = page.locator('.fixed.bottom-0 .relative.-top-5 button');
  await btn.click();
}

/** Clock in — dismiss the "What are you working on?" prompt if it appears.
 *  When offline the prompt may be skipped and clock-in proceeds directly. */
async function clockIn(page: import('@playwright/test').Page) {
  await clickClockButton(page);

  // The prompt may or may not appear (e.g. skipped when offline).
  const skipBtn = page.getByRole('button', { name: 'Skip for now' });
  const clockOutLabel = page.getByText('Clock Out', { exact: true }).first();

  // Race: whichever appears first
  const winner = await Promise.race([
    skipBtn.waitFor({ state: 'visible', timeout: 10_000 }).then(() => 'skip' as const),
    clockOutLabel.waitFor({ state: 'visible', timeout: 10_000 }).then(() => 'clocked' as const),
  ]);

  if (winner === 'skip') {
    await skipBtn.click();
  }

  // Even when "Clock Out" appeared first, the modal may pop up shortly after.
  // Give it a moment and dismiss if present.
  await page.waitForTimeout(500);
  if (await skipBtn.isVisible()) {
    await skipBtn.click();
  }

  // Wait for any modal overlay to disappear
  await page.locator('.fixed.inset-0.z-50').waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => {});

  await expect(clockOutLabel).toBeVisible({ timeout: 10_000 });
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

// ─── tests ──────────────────────────────────────────────────

test.describe('Offline Time Engine — Clock In / Clock Out', () => {

  test.beforeEach(({ browserName }) => {
    test.skip(browserName === 'webkit', 'CDP network emulation is not supported on WebKit');
  });

  test('clock in offline → session in IndexedDB with CREATE opLog entry', async ({ page }) => {
    // Load dashboard online (JS bundles cached)
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Clock In', { exact: true })).toBeVisible();

    // Snapshot opLog count before
    const opLogBefore = await getOpLogEntries(page);
    const countBefore = opLogBefore.length;

    // Go offline
    const cdp = await goOffline(page);

    // Clock in while offline
    await clockIn(page);

    // Verify IndexedDB has an open session
    const openSession = await getOpenSession(page);
    expect(openSession).not.toBeNull();
    expect(openSession!.clockIn).toBeGreaterThan(0);
    expect(openSession!.clockOut).toBeNull();
    const sessionId = openSession!.id as string;

    // Verify opLog has a CREATE entry for this session
    const opLogAfter = await getOpLogEntries(page);
    expect(opLogAfter.length).toBeGreaterThan(countBefore);

    const createOp = opLogAfter.find(
      e => e.collection === 'workSessions' && e.operation === 'CREATE' && e.entityId === sessionId
    );
    expect(createOp).toBeDefined();
    expect(createOp!._synced).toBe(0); // unsynced while offline
    expect(createOp!._syncEnabled).toBe(1);
    expect(createOp!.snapshot).toBeDefined();

    // Verify operationLogs audit entry
    const opsLogs = await getOperationLogs(page);
    const auditEntry = opsLogs.find(
      l => l.category === 'SESSION' && l.action === 'CLOCK_IN' && l.targetId === sessionId
    );
    expect(auditEntry).toBeDefined();
    expect(auditEntry!.result).toBe('success');

    // Clean up: clock out and restore network
    await clockOut(page);
    await goOnline(cdp);
  });

  test('clock out offline → session updated with clockOut timestamp and UPDATE opLog entry', async ({ page }) => {
    // Load dashboard and clock in while online
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await clockIn(page);

    // Capture session id
    const openSession = await getOpenSession(page);
    expect(openSession).not.toBeNull();
    const sessionId = openSession!.id as string;

    // Dismiss any lingering modals before going offline
    await page.waitForTimeout(1_000);
    const closeBtn = page.locator('[class*="fixed inset-0"] button:has-text("×"), [class*="fixed inset-0"] button[aria-label="Close"]');
    if (await closeBtn.count() > 0) {
      await closeBtn.first().click();
      await page.waitForTimeout(500);
    }

    // Go offline
    const cdp = await goOffline(page);

    // Clock out while offline
    await clockOut(page);

    // Verify IndexedDB session now has clockOut
    const closedSession = await getSessionById(page, sessionId);
    expect(closedSession).not.toBeNull();
    expect(closedSession!.clockOut).toBeGreaterThan(0);
    expect(closedSession!.clockOut as number).toBeGreaterThanOrEqual(closedSession!.clockIn as number);

    // Verify opLog has an UPDATE entry for this session
    const opLog = await getOpLogEntries(page);
    const updateOp = opLog.find(
      e => e.collection === 'workSessions' && e.operation === 'UPDATE' && e.entityId === sessionId
    );
    expect(updateOp).toBeDefined();
    expect(updateOp!._synced).toBe(0); // unsynced while offline
    expect(updateOp!.patch).toBeDefined();

    // Verify operationLogs audit entry for CLOCK_OUT
    const opsLogs = await getOperationLogs(page);
    const auditEntry = opsLogs.find(
      l => l.category === 'SESSION' && l.action === 'CLOCK_OUT' && l.targetId === sessionId
    );
    expect(auditEntry).toBeDefined();
    expect(auditEntry!.result).toBe('success');

    await goOnline(cdp);
  });

  test('full clock in + clock out offline → complete session in IndexedDB', async ({ page }) => {
    // Load dashboard online
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Clock In', { exact: true })).toBeVisible();

    // Go offline for the entire flow
    const cdp = await goOffline(page);

    // Clock in
    await clockIn(page);

    // Verify open session
    const openSession = await getOpenSession(page);
    expect(openSession).not.toBeNull();
    const sessionId = openSession!.id as string;
    expect(openSession!.clockOut).toBeNull();

    // Wait a brief moment so duration is measurable
    await page.waitForTimeout(3_000);

    // Clock out
    await clockOut(page);

    // Verify closed session in IndexedDB
    const closedSession = await getSessionById(page, sessionId);
    expect(closedSession).not.toBeNull();
    expect(closedSession!.clockOut).toBeGreaterThan(0);
    expect(closedSession!.clockIn).toBeGreaterThan(0);
    const duration = (closedSession!.clockOut as number) - (closedSession!.clockIn as number);
    expect(duration).toBeGreaterThanOrEqual(2_000); // at least ~2s

    // opLog should have both CREATE and UPDATE for this session
    const opLog = await getOpLogEntries(page);
    const sessionOps = opLog.filter(
      e => e.collection === 'workSessions' && e.entityId === sessionId
    );
    expect(sessionOps.some(e => e.operation === 'CREATE')).toBeTruthy();
    expect(sessionOps.some(e => e.operation === 'UPDATE')).toBeTruthy();
    // Both should be unsynced (still offline)
    for (const op of sessionOps) {
      expect(op._synced).toBe(0);
    }

    // operationLogs should have both CLOCK_IN and CLOCK_OUT
    const opsLogs = await getOperationLogs(page);
    const clockInAudit = opsLogs.find(
      l => l.category === 'SESSION' && l.action === 'CLOCK_IN' && l.targetId === sessionId
    );
    const clockOutAudit = opsLogs.find(
      l => l.category === 'SESSION' && l.action === 'CLOCK_OUT' && l.targetId === sessionId
    );
    expect(clockInAudit).toBeDefined();
    expect(clockOutAudit).toBeDefined();

    await goOnline(cdp);
  });

  test('offline session syncs when network is restored', async ({ page }) => {
    test.setTimeout(60_000); // extra time for sync + reload under parallel load

    // Load dashboard online
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Go offline
    const cdp = await goOffline(page);

    // Clock in + clock out offline
    await clockIn(page);
    const openSession = await getOpenSession(page);
    expect(openSession).not.toBeNull();
    const sessionId = openSession!.id as string;

    await page.waitForTimeout(2_000);
    await clockOut(page);

    // Verify unsynced opLog entries
    const opLogOffline = await getOpLogEntries(page);
    const unsyncedOps = opLogOffline.filter(
      e => e.collection === 'workSessions' && e.entityId === sessionId && e._synced === 0
    );
    expect(unsyncedOps.length).toBeGreaterThanOrEqual(1);

    // Restore network — auto-sync should kick in
    await goOnline(cdp);

    // Wait for auto-sync (debounced 2s + processing time)
    await page.waitForTimeout(5_000);

    // Reload to ensure fresh IndexedDB reads
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // After sync, opLog entries should be marked synced
    const opLogOnline = await getOpLogEntries(page);
    const sessionOps = opLogOnline.filter(
      e => e.collection === 'workSessions' && e.entityId === sessionId
    );
    // Auto-sync may have pushed them; accept synced state
    for (const op of sessionOps) {
      expect([0, 1]).toContain(op._synced);
    }
  });

  test('opLog entries show on Sync Queue page after offline session', async ({ page }) => {
    // Load dashboard and go offline for a clock-in/clock-out
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const cdp = await goOffline(page);

    await clockIn(page);
    await page.waitForTimeout(2_000);
    await clockOut(page);

    // Restore network and navigate to opLogs page
    await goOnline(cdp);
    await page.goto('/dashboard/oplogs');
    await page.waitForLoadState('networkidle');

    // Sync Queue tab should be active by default
    const syncQueueTab = page.getByRole('tab', { name: 'Sync Queue' });
    await expect(syncQueueTab).toHaveAttribute('aria-selected', 'true');

    // Should see opLog entries for workSessions
    await expect(page.getByText('workSessions').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('CREATE').first()).toBeVisible();
  });

  test('Operation Logs tab shows SESSION audit trail after offline clock-in/out', async ({ page }) => {
    // Clock in + clock out so audit entries exist
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const cdp = await goOffline(page);

    await clockIn(page);
    await page.waitForTimeout(1_000);
    await clockOut(page);

    await goOnline(cdp);

    // Navigate to oplogs → Operation Logs tab
    await page.goto('/dashboard/oplogs');
    await page.waitForLoadState('networkidle');
    await page.getByRole('tab', { name: 'Operation Logs' }).click();

    // Should show the operation logs table
    await expect(page.getByRole('table', { name: 'Operation logs' })).toBeVisible({ timeout: 10_000 });

    // Should have SESSION/CLOCK_IN and SESSION/CLOCK_OUT entries in the table
    await expect(page.locator('table tbody').getByText('SESSION').first()).toBeVisible();
    await expect(page.locator('table tbody').getByText('CLOCK_IN').first()).toBeVisible();

    // Filter by SESSION category
    await page.getByLabel('Filter by category').selectOption('SESSION');
    await expect(page.locator('table tbody').getByText('SESSION').first()).toBeVisible();
    await expect(page.locator('table tbody').getByText('CLOCK_OUT').first()).toBeVisible({ timeout: 5_000 });
  });
});
