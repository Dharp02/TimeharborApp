import { test, expect } from './fixtures/auth';

test.describe('Settings Page', () => {

  test('renders settings page with user name', async ({ authedPage: page }) => {
    await page.goto('/dashboard/settings');
    await page.waitForLoadState('networkidle');

    // User name should appear in the main settings area
    await expect(page.getByText('E2E Worker').first()).toBeVisible({ timeout: 10_000 });
  });

  test('shows settings menu items', async ({ authedPage: page }) => {
    await page.goto('/dashboard/settings');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Edit Profile').first()).toBeVisible({ timeout: 10_000 });
  });

  test('dark mode toggle is present', async ({ authedPage: page }) => {
    await page.goto('/dashboard/settings');
    await page.waitForLoadState('networkidle');

    const darkToggle = page.locator('[aria-label*="dark mode" i]')
      .or(page.getByRole('switch', { name: /dark mode/i }));

    await expect(darkToggle.first()).toBeVisible({ timeout: 10_000 });
  });

  test('notification toggle is present', async ({ authedPage: page }) => {
    await page.goto('/dashboard/settings');
    await page.waitForLoadState('networkidle');

    const notifToggle = page.locator('[aria-label*="notification" i]')
      .or(page.getByRole('switch', { name: /notification/i }));

    await expect(notifToggle.first()).toBeVisible({ timeout: 10_000 });
  });

  test('can navigate to edit profile', async ({ authedPage: page }) => {
    await page.goto('/dashboard/settings');
    await page.waitForLoadState('networkidle');

    await page.getByRole('link', { name: /edit profile/i }).first().click();
    await expect(page).toHaveURL(/\/dashboard\/settings\/profile/);
  });
});
