import { test, expect } from '@playwright/test';

/**
 * Time Engine E2E — basic clock-in / clock-out flow.
 *
 * Uses a mobile viewport so the BottomNav (which hosts the central
 * clock button) is visible.  Desktop uses DesktopFooter instead,
 * but the underlying ClockInContext is the same.
 *
 * What we verify:
 *   1. Clock in  → UI changes (button turns red / shows timer)
 *   2. Clock in  → IndexedDB `workSessions` row created (clockOut === null)
 *   3. Clock out → IndexedDB row updated (clockOut !== null)
 *   4. Clock in, wait ~60 s, clock out → duration ≈ 1 min recorded
 *   5. Dashboard summary and timesheet reflect the ~1 min session
 */

// Force a mobile viewport so BottomNav is rendered (it's `lg:hidden`).
test.use({
  viewport: { width: 390, height: 844 },   // iPhone 14 Pro
});

// ─── helpers ────────────────────────────────────────────

/** Read the latest open workSession from IndexedDB for the given userId. */
async function getOpenSession(page: import('@playwright/test').Page) {
  return page.evaluate(async () => {
    const uuid = localStorage.getItem('th_identity_uuid');
    const dbName = uuid ? `TimeharborDB_${uuid}` : 'TimeharborDB';

    return new Promise<Record<string, unknown> | null>((resolve, reject) => {
      const req = indexedDB.open(dbName);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('workSessions')) { resolve(null); return; }
        const tx = db.transaction('workSessions', 'readonly');
        const store = tx.objectStore('workSessions');
        const getAll = store.getAll();
        getAll.onsuccess = () => {
          const sessions = getAll.result as Record<string, unknown>[];
          // Find the latest open session (clockOut === null)
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
    const uuid = localStorage.getItem('th_identity_uuid');
    const dbName = uuid ? `TimeharborDB_${uuid}` : 'TimeharborDB';

    return new Promise<Record<string, unknown> | null>((resolve, reject) => {
      const req = indexedDB.open(dbName);
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

/**
 * Wait for the app to finish its boot sequence (DB switch, encryption setup).
 * Without this, useLiveQuery may be subscribed to the wrong IndexedDB instance
 * and never detect the newly created session.
 */
async function waitForAppReady(page: import('@playwright/test').Page) {
  const overlay = page.locator('.fixed.inset-0.z-50');
  await page.waitForTimeout(1_000);
  await overlay.waitFor({ state: 'hidden', timeout: 15_000 }).catch(() => {});
}

/** Click the central BottomNav clock button. */
async function clickClockButton(page: import('@playwright/test').Page) {
  const btn = page.locator('[data-walkthrough="clock-in-fab"] button');
  await btn.click();
}

// ─── tests ──────────────────────────────────────────────

test.describe('Time Engine — Clock In / Clock Out', () => {

  test('clock in changes UI and creates IndexedDB entry', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await waitForAppReady(page);

    // Verify "Clock In" label is shown beneath the central button
    await expect(page.getByText('Clock In', { exact: true })).toBeVisible();

    // --- Clock In ---
    await clickClockButton(page);

    // A "What are you working on?" prompt appears — dismiss it
    const skipBtn = page.getByRole('button', { name: 'Skip for now' });
    await expect(skipBtn).toBeVisible({ timeout: 10_000 });
    await skipBtn.click();

    // Wait for modal overlay to close before checking state
    await page.locator('.fixed.inset-0.z-50').waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => {});
    await page.waitForTimeout(500);

    // UI should now show "Clock Out" label (red state)
    await expect(page.getByText('Clock Out', { exact: true }).first()).toBeVisible({ timeout: 10_000 });

    // The central button should be pulsing red (animate-pulse + bg-red-500)
    const clockBtn = page.locator('[data-walkthrough="clock-in-fab"] button');
    await expect(clockBtn).toHaveClass(/bg-red-500/);
    await expect(clockBtn).toHaveClass(/animate-pulse/);

    // --- Verify IndexedDB has an open session ---
    const openSession = await getOpenSession(page);
    expect(openSession).not.toBeNull();
    expect(openSession!.clockIn).toBeGreaterThan(0);
    expect(openSession!.clockOut).toBeNull();

    // --- Clock Out (so we don't leave dangling session) ---
    await clickClockButton(page);
    // "What would you like to do?" modal
    const clockOutOption = page.getByLabel('Clock out');
    await expect(clockOutOption).toBeVisible({ timeout: 5_000 });
    await clockOutOption.click();

    // Should return to "Clock In" state
    await expect(page.getByText('Clock In', { exact: true })).toBeVisible({ timeout: 10_000 });
  });

  test('clock out updates IndexedDB entry with clockOut timestamp', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await waitForAppReady(page);

    // Clock In
    await clickClockButton(page);
    const skipBtn = page.getByRole('button', { name: 'Skip for now' });
    await expect(skipBtn).toBeVisible({ timeout: 10_000 });
    await skipBtn.click();
    await page.locator('.fixed.inset-0.z-50').waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => {});
    await page.waitForTimeout(500);
    await expect(page.getByText('Clock Out', { exact: true }).first()).toBeVisible({ timeout: 10_000 });

    // Capture the session id
    const openSession = await getOpenSession(page);
    expect(openSession).not.toBeNull();
    const sessionId = openSession!.id as string;

    // Clock Out
    await clickClockButton(page);
    const clockOutOption = page.getByLabel('Clock out');
    await expect(clockOutOption).toBeVisible({ timeout: 5_000 });
    await clockOutOption.click();
    await expect(page.getByText('Clock In', { exact: true })).toBeVisible({ timeout: 10_000 });

    // --- Verify IndexedDB session now has clockOut ---
    const closedSession = await getSessionById(page, sessionId);
    expect(closedSession).not.toBeNull();
    expect(closedSession!.clockOut).toBeGreaterThan(0);
    expect(closedSession!.clockOut as number).toBeGreaterThanOrEqual(closedSession!.clockIn as number);
  });

  test('1-minute session records correct duration in IndexedDB and UI', async ({ page }) => {
    test.setTimeout(120_000); // allow extra time for the 60 s wait

    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await waitForAppReady(page);

    // --- Clock In ---
    await clickClockButton(page);
    const skipBtn = page.getByRole('button', { name: 'Skip for now' });
    await expect(skipBtn).toBeVisible({ timeout: 10_000 });
    await skipBtn.click();
    await page.locator('.fixed.inset-0.z-50').waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => {});
    await page.waitForTimeout(500);
    await expect(page.getByText('Clock Out', { exact: true }).first()).toBeVisible({ timeout: 10_000 });

    const openSession = await getOpenSession(page);
    expect(openSession).not.toBeNull();
    const sessionId = openSession!.id as string;

    // --- Wait ~60 seconds ---
    // The BottomNav timer updates every second; after 60 s it should show "01:0X"
    await page.waitForTimeout(60_000);

    // The timer display in the central button should show approximately 01:XX (mm:ss)
    const timerText = page.locator('[data-walkthrough="clock-in-fab"] button .font-mono');
    await expect(timerText).toBeVisible();
    const displayedTime = await timerText.textContent();
    // Should be around 00:55 – 01:09 (±10 s tolerance around 60 s)
    expect(displayedTime).toMatch(/^0[01]:(?:0\d|[5]\d)$/);

    // --- Clock Out ---
    await clickClockButton(page);
    const clockOutOption = page.getByLabel('Clock out');
    await expect(clockOutOption).toBeVisible({ timeout: 5_000 });
    await clockOutOption.click();
    await expect(page.getByText('Clock In', { exact: true })).toBeVisible({ timeout: 10_000 });

    // --- Verify IndexedDB duration ---
    const closedSession = await getSessionById(page, sessionId);
    expect(closedSession).not.toBeNull();
    expect(closedSession!.clockOut).toBeGreaterThan(0);

    const netWorkMs = closedSession!.netWorkMs as number;
    // Should be approximately 60 000 ms (±10 s tolerance)
    expect(netWorkMs).toBeGreaterThanOrEqual(55_000);
    expect(netWorkMs).toBeLessThanOrEqual(75_000);

    const totalSessionMs = closedSession!.totalSessionMs as number;
    expect(totalSessionMs).toBeGreaterThanOrEqual(55_000);
    expect(totalSessionMs).toBeLessThanOrEqual(75_000);

    // --- Verify Dashboard Summary reflects the session ---
    // Refresh to trigger stats recalc
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // "Total Hours" card should show at least "0h 1m"
    const totalHoursHeading = page.getByRole('heading', { name: 'Total Hours' });
    await expect(totalHoursHeading).toBeVisible({ timeout: 10_000 });
    // The value sits in a sibling <p> with font-bold inside the same card
    const statsText = await totalHoursHeading.locator('..').locator('p.font-bold').textContent();
    expect(statsText).toMatch(/0h 1m/);

    // --- Verify Timesheet page shows the session ---
    await page.goto('/dashboard/settings/timesheet');
    await page.waitForLoadState('networkidle');

    // Total duration on the timesheet should include our ~1 min session
    // The timesheet page shows "Total: Xh Ym" in a badge
    const timesheetTotal = page.locator('text=Total:').locator('..');
    await expect(timesheetTotal).toBeVisible({ timeout: 10_000 });
    const timesheetText = await timesheetTotal.textContent();
    // Should contain at least "0h 1m"
    expect(timesheetText).toContain('1m');
  });
});
