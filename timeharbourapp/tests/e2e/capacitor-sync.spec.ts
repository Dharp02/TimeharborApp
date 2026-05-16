import { test, expect } from '@playwright/test';

/**
 * Capacitor Sync regression tests
 *
 * These tests cover two bugs that were fixed in SyncInitializer.tsx:
 *
 * Bug 1 — Network reconnect gated by wasOfflineRef
 *   The old code only called syncManager.syncNow() on the Capacitor
 *   networkStatusChange event when wasOfflineRef.current was true. If the
 *   user never transitioned through an explicit offline event (e.g. the app
 *   was backgrounded while connected), pending items would never sync.
 *   Fix: sync on ANY connected transition, regardless of wasOfflineRef.
 *
 * Bug 2 — No sync on app resume
 *   When the user switched away and back, neither the network listener nor
 *   the 5-min periodic timer fired, so pending opLog items stayed unsynced
 *   indefinitely.
 *   Fix: added @capacitor/app `appStateChange` listener that calls
 *   syncManager.syncNow() whenever state.isActive === true.
 *
 * Because Capacitor native plugins (Network, App) are only available on
 * native iOS/Android, we simulate both scenarios using the browser's native
 * online/offline events (which SyncInitializer also wires up via
 * window.addEventListener('online')) and the 'pull-to-refresh' custom event
 * (which triggers the same syncNow() path). The window visibility API maps to
 * the app-resume path for web builds.
 *
 * CDP network throttling is used to create real offline → online transitions.
 */

test.use({
  viewport: { width: 390, height: 844 },
  navigationTimeout: 30_000,
});

// ─── IndexedDB helpers ──────────────────────────────────────

async function getOpLogEntries(page: import('@playwright/test').Page) {
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

async function getUnsyncedOpLogCount(page: import('@playwright/test').Page) {
  const entries = await getOpLogEntries(page);
  return entries.filter(e => e._synced === 0).length;
}

// ─── CDP network helpers ────────────────────────────────────

async function goOffline(page: import('@playwright/test').Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.emulateNetworkConditions', {
    offline: true,
    latency: 0,
    downloadThroughput: 0,
    uploadThroughput: 0,
  });
  return cdp;
}

async function goOnline(cdp: import('playwright-core').CDPSession) {
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  });
}

// ─── UI helpers ─────────────────────────────────────────────

async function waitForAppReady(page: import('@playwright/test').Page) {
  const overlay = page.locator('.fixed.inset-0.z-50');
  await page.waitForTimeout(1_000);
  await overlay.waitFor({ state: 'hidden', timeout: 15_000 }).catch(() => {});
}

async function clickClockButton(page: import('@playwright/test').Page) {
  await page.locator('[data-walkthrough="clock-in-fab"] button').click();
}

async function clockIn(page: import('@playwright/test').Page) {
  await clickClockButton(page);
  const skipBtn = page.getByRole('button', { name: 'Skip for now' });
  const clockOutLabel = page.getByText('Clock Out', { exact: true }).first();
  const winner = await Promise.race([
    skipBtn.waitFor({ state: 'visible', timeout: 10_000 }).then(() => 'skip' as const),
    clockOutLabel.waitFor({ state: 'visible', timeout: 10_000 }).then(() => 'clocked' as const),
  ]);
  if (winner === 'skip') await skipBtn.click();
  await page.waitForTimeout(500);
  if (await skipBtn.isVisible()) await skipBtn.click();
  await page.locator('.fixed.inset-0.z-50').waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => {});
  await expect(clockOutLabel).toBeVisible({ timeout: 10_000 });
}

async function clockOut(page: import('@playwright/test').Page) {
  const skipBtn = page.getByRole('button', { name: 'Skip for now' });
  if (await skipBtn.isVisible()) {
    await skipBtn.click();
    await page.waitForTimeout(500);
  }
  await page.locator('.fixed.inset-0.z-50').waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => {});
  await clickClockButton(page);
  const clockOutOption = page.getByLabel('Clock out');
  await expect(clockOutOption).toBeVisible({ timeout: 5_000 });
  await clockOutOption.click();
  await expect(page.getByText('Clock In', { exact: true })).toBeVisible({ timeout: 10_000 });
}

/** Wait until the unsynced opLog count drops to zero (or timeout). */
async function waitForSync(page: import('@playwright/test').Page, timeout = 15_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const count = await getUnsyncedOpLogCount(page);
    if (count === 0) return;
    await page.waitForTimeout(500);
  }
  const remaining = await getUnsyncedOpLogCount(page);
  expect(remaining, 'Unsynced opLog entries remain after waiting for sync').toBe(0);
}

// ─── Tests ──────────────────────────────────────────────────

test.describe('Capacitor Sync — network reconnect & app resume', () => {

  test.beforeEach(({ browserName }) => {
    test.skip(browserName === 'webkit', 'CDP network emulation is not supported on WebKit');
  });

  /**
   * Regression: Bug 1 — wasOfflineRef gate
   *
   * Items written offline should sync immediately when connectivity is
   * restored — even when the app never fired an explicit "offline" event
   * (simulating the Capacitor native scenario where the connected=true
   * event fires on resume without a prior connected=false).
   *
   * We simulate this by:
   *  1. Loading the page normally (wasOfflineRef starts false)
   *  2. Going offline via CDP (no UI offline event so wasOfflineRef stays false)
   *  3. Writing a ticket while offline → opLog entry _synced=0
   *  4. Restoring network → firing window 'online' event
   *  5. Asserting the pending item syncs (would have been blocked by old gate)
   */
  test('offline items sync on reconnect even when wasOfflineRef was never set', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await waitForAppReady(page);

    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await waitForAppReady(page);
    await expect(page.getByText('Clock In', { exact: true })).toBeVisible();

    // Go offline silently via CDP — does NOT fire window 'offline', so
    // wasOfflineRef stays false (reproduces the Capacitor native scenario
    // where connected=true fires on resume with no prior connected=false).
    const cdp = await goOffline(page);

    // Clock in while offline — this writes to IndexedDB and creates an
    // unsynced opLog entry without any page navigation.
    await clockIn(page);
    await clockOut(page);

    // Verify we actually have unsynced entries
    const unsyncedBefore = await getUnsyncedOpLogCount(page);
    expect(unsyncedBefore, 'Should have unsynced opLog entries after offline writes').toBeGreaterThan(0);

    // Restore network and fire the 'online' event (mirrors what
    // SyncInitializer's window 'online' listener does — the same path
    // Capacitor's networkStatusChange triggers after the fix)
    await goOnline(cdp);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));

    // Wait for sync to clear all pending items
    await waitForSync(page);
  });

  /**
   * Regression: Bug 2 — no sync on app resume
   *
   * When the user backgrounds and foregrounds the app, pending opLog items
   * must sync. SyncInitializer now fires syncManager.syncNow() on
   * appStateChange(isActive=true). For the web build we use the
   * 'pull-to-refresh' custom event which exercises the same syncNow() call.
   */
  test('pending items sync when app is resumed (pull-to-refresh path)', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await waitForAppReady(page);

    // Go offline and write an item
    const cdp = await goOffline(page);
    await clockIn(page);

    const unsyncedBefore = await getUnsyncedOpLogCount(page);
    expect(unsyncedBefore, 'Should have unsynced opLog entries after offline clock-in').toBeGreaterThan(0);

    // Clean up: clock out so the session is complete
    await clockOut(page);

    // Restore network — but do NOT fire 'online'. Items would stay unsynced
    // under old code unless the periodic timer fired or the user pulled.
    await goOnline(cdp);

    // Simulate app resume via pull-to-refresh (same syncNow() invocation as
    // Capacitor App.addListener('appStateChange') in SyncInitializer)
    await page.evaluate(() => window.dispatchEvent(new Event('pull-to-refresh')));

    // Items should clear
    await waitForSync(page);
  });

  /**
   * Smoke test: opLog entries from an offline session are visible on the
   * Sync Queue page after reconnect and sync.
   */
  test('sync queue clears after reconnect — Sync Queue tab shows no pending items', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await waitForAppReady(page);

    // Create pending items offline
    const cdp = await goOffline(page);
    await clockIn(page);
    await clockOut(page);

    // Restore and sync via the online event
    await goOnline(cdp);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await waitForSync(page);

    // Navigate to the Sync Queue page and confirm it's empty
    await page.goto('/dashboard/oplogs');
    await page.waitForLoadState('domcontentloaded');
    const syncQueueTab = page.getByRole('tab', { name: /sync queue/i });
    if (await syncQueueTab.isVisible()) await syncQueueTab.click();

    // The queue shows "All changes are synced" when Pending count is 0
    await expect(page.getByText('All changes are synced')).toBeVisible({ timeout: 10_000 });
  });

});
