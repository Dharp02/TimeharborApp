import { test as base, expect, type Page } from '@playwright/test';

type AuthFixtures = {
  /** A Page navigated to the dashboard (no auth layer). */
  authedPage: Page;
};

/**
 * Extends the base Playwright test with an `authedPage` fixture.
 *
 * The app has no authentication layer, so this fixture simply opens a fresh
 * browser context with the walkthrough suppressed and navigates to /dashboard.
 */
export const test = base.extend<AuthFixtures>({
  authedPage: [
    async ({ browser, baseURL }, use) => {
      // Pre-set localStorage so the walkthrough modal never appears.
      // storageState is applied at context creation — before any JS runs.
      const ctx = await browser.newContext({
        storageState: {
          cookies: [],
          origins: [
            {
              origin: baseURL!,
              localStorage: [
                { name: 'th_walkthrough_completed', value: '1' },
              ],
            },
          ],
        },
      });
      const page = await ctx.newPage();

      await page.goto('/dashboard');
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

      await use(page);
      await ctx.close();
    },
    { timeout: 60_000 },
  ],
});

export { expect };
