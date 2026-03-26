import { test, expect } from './fixtures/auth';

/**
 * Dashboard Home Page feature tests.
 * Requires an authenticated session (provided by authedPage fixture).
 */

test.describe('Dashboard Home', () => {

  test('renders main dashboard layout', async ({ authedPage: page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Sidebar brand name
    await expect(page.getByText('TimeHarbor').first()).toBeVisible({ timeout: 10_000 });
  });

  test('displays sidebar navigation buttons', async ({ authedPage: page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Core sidebar nav buttons
    const navButtons = ['Time Tracker', 'Tickets', 'Settings'];
    for (const label of navButtons) {
      await expect(page.getByRole('button', { name: label }).first()).toBeVisible({ timeout: 10_000 });
    }
  });

  test('shows sign out button', async ({ authedPage: page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('button', { name: 'Sign Out' })).toBeVisible({ timeout: 10_000 });
  });

  test('navigates to tickets page via sidebar', async ({ authedPage: page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Tickets' }).first().click();
    await expect(page).toHaveURL(/\/dashboard\/tickets/);
  });

  test('navigates to settings page via sidebar', async ({ authedPage: page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Settings' }).first().click();
    await expect(page).toHaveURL(/\/dashboard\/settings/);
  });

  test('shows dashboard summary stats', async ({ authedPage: page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'Total Hours' })).toBeVisible({ timeout: 10_000 });
  });

  test('shows clock-in button', async ({ authedPage: page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Ready to Work?')).toBeVisible({ timeout: 10_000 });
  });
});
