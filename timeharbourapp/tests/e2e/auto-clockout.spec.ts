import { test, expect } from '@playwright/test';

test.use({
  viewport: { width: 390, height: 844 },
});

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

test('Session auto clocks out after 8 hours', async ({ page }) => {
  // Use Playwright clock to control time
  await page.clock.install({ time: new Date('2026-04-16T08:00:00.000Z') });

  // 1. Go to dashboard and login (assuming generic test setup)
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');
  await waitForAppReady(page);
  
  // 2. Wait for Clock In button and click it
  const clockInBtn = page.locator('[data-walkthrough="clock-in-fab"] button');
  await expect(clockInBtn).toBeVisible({ timeout: 10_000 });
  await clockInBtn.click();

  // Dismiss the "What are you working on?" modal if it appears
  const skipBtn = page.getByRole('button', { name: 'Skip for now' });
  if (await skipBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await skipBtn.click();
  }

  await expect(page.locator('text="Clock Out"').first()).toBeVisible({ timeout: 10_000 });

  // 3. Fast-forward time by exactly 8 hours to 4:00 PM
  await page.clock.fastForward(8 * 60 * 60 * 1000);

  await expect(page.locator('text="Clock In"').first()).toBeVisible({ timeout: 10_000 });

  const session: any = await page.evaluate(async () => {
    const uuid = localStorage.getItem('th_identity_uuid');
    const dbName = uuid ? `TimeharborDB_${uuid}` : 'TimeharborDB';
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(dbName);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('workSessions', 'readonly');
        const store = tx.objectStore('workSessions');
        const getAll = store.getAll();
        getAll.onsuccess = () => {
          const sessions = getAll.result;
          resolve(sessions.sort((a: any, b: any) => b.clockIn - a.clockIn)[0] ?? null);
        };
        getAll.onerror = () => reject(getAll.error);
      };
    });
  });

  expect(session).toBeTruthy();
  expect(session.clockOut).toBe(session.clockIn + 8 * 60 * 60 * 1000);
  expect(session.comment).toContain('Auto-clocked out after 8 hours.');
});
