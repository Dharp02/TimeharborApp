import { test as base, expect, type Page, type BrowserContext } from '@playwright/test';

const TEST_PASSWORD = 'SecurePass123!';

/**
 * Shared fixture that provides an authenticated page.
 * Creates a unique user via signup once per worker, then re-uses the session.
 */
export const test = base.extend<{ authedPage: Page }>({
  authedPage: [async ({ browser }, use) => {
    const email = `e2e-worker-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;

    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    // Sign up a fresh user
    await page.goto('/signup');
    await page.getByLabel('Full Name').fill('E2E Worker');
    await page.getByLabel('Email').fill(email);
    await page.locator('#password').fill(TEST_PASSWORD);
    await page.locator('#confirmPassword').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'Create Account' }).click();

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

    // Wait for dashboard to fully load
    await page.waitForLoadState('networkidle');

    await use(page);

    await ctx.close();
  }, { timeout: 60_000 }],
});

export { expect };
