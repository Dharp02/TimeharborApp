import { test as base, expect, type Page } from '@playwright/test';
import { TEST_PASSWORD, uniqueEmail } from '../helpers/test-data';

type AuthFixtures = {
  /** A Page that is already signed in to a fresh test user. */
  authedPage: Page;
};

/**
 * Extends the base Playwright test with an `authedPage` fixture.
 *
 * Each worker gets its own unique user created via the API.
 * The authenticated browser context is shared for the life of the fixture.
 */
export const test = base.extend<AuthFixtures>({
  authedPage: [
    async ({ browser, baseURL }, use) => {
      const email = uniqueEmail('e2e-worker');

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

      // Register a new user via the better-auth API endpoint
      const res = await page.request.post(`${baseURL}/api/auth/sign-up/email`, {
        data: { email, password: TEST_PASSWORD, name: 'E2E Worker' },
        headers: { 'Content-Type': 'application/json' },
      });
      expect(res.ok(), `Signup API failed: ${res.status()}`).toBe(true);

      // Navigate to dashboard — AuthProvider picks up the session cookie
      await page.goto('/dashboard');
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

      await use(page);
      await ctx.close();
    },
    { timeout: 60_000 },
  ],
});

export { expect };
