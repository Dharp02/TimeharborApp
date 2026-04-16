import { test, expect } from '@playwright/test';

test.use({
  viewport: { width: 390, height: 844 },
});

test('Session auto clocks out after 8 hours', async ({ page }) => {
  // Use Playwright clock to control time
  await page.clock.install({ time: new Date('2026-04-16T08:00:00.000Z') });

  // 1. Go to dashboard and login (assuming generic test setup)
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');
  
  const skipButton = page.locator('text=Skip');
  if (await skipButton.isVisible()) {
    await skipButton.click();
  }

  const clockInSpan = page.locator('text="Clock In"').first();
  await clockInSpan.waitFor({ state: 'visible' });
  const clockInBtn = clockInSpan.locator('xpath=..').locator('button');

  // 2. Clock in at 8:00 AM
  await clockInBtn.click();
  
  await expect(page.locator('text="Clock Out"').first()).toBeVisible();

  // 3. Fast-forward time by exactly 8 hours to 4:00 PM
  await page.clock.fastForward('08:00:00'); // advance was renamed to fastForward

  await expect(page.locator('text="Clock In"').first()).toBeVisible({ timeout: 5000 });

  const session = await page.evaluate(async () => {
    return new Promise((resolve, reject) => {
      const dbs = indexedDB.databases();
      dbs.then(info => {
        const dbName = info.find(d => d.name?.toLowerCase().includes('timeharbor'))?.name;
        if (!dbName) return resolve(null);
        const req = indexedDB.open(dbName);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('workSessions', 'readonly');
          const store = tx.objectStore('workSessions');
          const getAll = store.getAll();
          getAll.onsuccess = () => {
            const sessions = getAll.result;
            resolve(sessions.sort((a,b) => b.clockIn - a.clockIn)[0]);
          };
        }
      });
    });
  });

  expect(session).toBeTruthy();
  expect(session.clockOut).toBe(session.clockIn + 8 * 60 * 60 * 1000);
  expect(session.comment).toContain('Auto-clocked out after 8 hours.');
});
