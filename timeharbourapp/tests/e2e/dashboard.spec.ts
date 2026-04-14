import { test, expect } from '@playwright/test';
import { DashboardPage } from '../pages';

test.describe('Dashboard Layout', () => {
  test('renders brand name in sidebar', async ({ page }) => {
    const dash = new DashboardPage(page);
    await dash.navigate();

    await expect(dash.brandName).toBeVisible();
  });

  test('displays core sidebar navigation', async ({ page }) => {
    const dash = new DashboardPage(page);
    await dash.navigate();

    const navItems = ['Time Tracker', 'Tickets', 'Settings'];
    for (const label of navItems) {
      await expect(dash.sidebarButton(label)).toBeVisible();
    }
  });

  test('shows sign out button', async ({ page }) => {
    const dash = new DashboardPage(page);
    await dash.navigate();

    await expect(dash.signOutButton).toBeVisible();
  });

  test('shows dashboard summary stats', async ({ page }) => {
    const dash = new DashboardPage(page);
    await dash.navigate();

    await expect(dash.totalHoursHeading).toBeVisible();
  });

  test('shows clock-in prompt', async ({ page }) => {
    const dash = new DashboardPage(page);
    await dash.navigate();

    await expect(dash.readyToWork).toBeVisible();
  });
});

test.describe('Dashboard Navigation', () => {
  test('navigates to tickets page via sidebar', async ({ page }) => {
    const dash = new DashboardPage(page);
    await dash.navigate();
    await dash.navigateVia('Tickets');

    await expect(page).toHaveURL(/\/dashboard\/tickets/);
  });

  test('navigates to settings page via sidebar', async ({ page }) => {
    const dash = new DashboardPage(page);
    await dash.navigate();
    await dash.navigateVia('Settings');

    await expect(page).toHaveURL(/\/dashboard\/settings/);
  });
});
