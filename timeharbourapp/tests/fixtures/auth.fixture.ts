import { test as base, expect, type Page } from '@playwright/test';
import { TEST_PASSWORD, uniqueEmail } from '../helpers/test-data';

type AuthFixtures = {
  /** A Page that is already signed in to a fresh test user. */
  authedPage: Page;
};

/**
 * Extends the base Playwright test with an `authedPage` fixture.
 *
 * Each worker gets its own unique user created via the signup form.
 * The authenticated browser context is shared for the life of the fixture.
 */
export const test = base.extend<AuthFixtures>({
  authedPage: [
    async ({ browser }, use) => {
      const email = uniqueEmail('e2e-worker');
      const ctx = await browser.newContext();
      const page = await ctx.newPage();

      await page.goto('/signup');
      await page.getByLabel('Full Name').fill('E2E Worker');
      await page.getByLabel('Email').fill(email);
      await page.locator('#password').fill(TEST_PASSWORD);
      await page.locator('#confirmPassword').fill(TEST_PASSWORD);
      await page.getByRole('button', { name: 'Create Account' }).click();

      await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
      await page.waitForLoadState('networkidle');

      await use(page);
      await ctx.close();
    },
    { timeout: 60_000 },
  ],
});

export { expect };
