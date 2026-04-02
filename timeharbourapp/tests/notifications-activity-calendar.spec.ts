import { test, expect } from './fixtures/auth';

test.describe('Notifications Page', () => {

  test('renders notifications page', async ({ authedPage: page }) => {
    await page.goto('/dashboard/notifications');
    await page.waitForLoadState('networkidle');

    // New user should see empty state
    await expect(page.getByText('No notifications yet')).toBeVisible({ timeout: 10_000 });
  });

  test('shows informational message', async ({ authedPage: page }) => {
    await page.goto('/dashboard/notifications');
    await page.waitForLoadState('networkidle');

    await expect(
      page.getByText(/notify you when something important/i)
    ).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Activity Page', () => {

  test('renders activity page', async ({ authedPage: page }) => {
    await page.goto('/dashboard/activity');
    await page.waitForLoadState('networkidle');

    // New user should see empty state or "No activity"
    await expect(
      page.getByText(/no activity|clock in/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Calendar Page', () => {

  test('renders calendar page with heading', async ({ authedPage: page }) => {
    await page.goto('/dashboard/calendar');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Calendar').first()).toBeVisible({ timeout: 10_000 });
  });
});
