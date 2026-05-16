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

  test('shows app version in sidebar footer', async ({ page }) => {
    const dash = new DashboardPage(page);
    await dash.navigate();

    await expect(dash.versionText).toBeVisible();
  });

  test('shows dashboard summary stats', async ({ page }) => {
    const dash = new DashboardPage(page);
    await dash.navigate();

    await expect(dash.totalHoursHeading).toBeVisible();
  });

  test('shows clock-in prompt', async ({ page }) => {
    const dash = new DashboardPage(page);
    await dash.navigate();

    // Desktop shows "Ready to Work?" in the footer; mobile shows "Clock In" label
    // in the BottomNav. Both exist in the DOM; assert at least one is present.
    const prompt = page.getByText('Ready to Work?');
    const label = page.getByText('Clock In', { exact: true });
    const count = await prompt.count() + await label.count();
    expect(count).toBeGreaterThan(0);
  });
});

test.describe('Dashboard Navigation', () => {
  test('navigates to tickets page via sidebar', async ({ page }) => {
    const dash = new DashboardPage(page);
    await dash.navigate();
    await page.waitForLoadState('networkidle');

    // On mobile viewports the sidebar is hidden — open it first.
    // SidebarMobileToggle only renders on mobile, so use its presence as the indicator.
    const mobileToggle = page.getByRole('button', { name: 'Open navigation' });
    if (await mobileToggle.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await mobileToggle.click();
      await page.waitForTimeout(300);
    }
    await dash.sidebarButton('Tickets').click();

    await expect(page).toHaveURL(/\/dashboard\/tickets/);
  });

  test('navigates to settings page via sidebar', async ({ page }) => {
    const dash = new DashboardPage(page);
    await dash.navigate();
    await page.waitForLoadState('networkidle');

    const mobileToggle = page.getByRole('button', { name: 'Open navigation' });
    if (await mobileToggle.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await mobileToggle.click();
      await page.waitForTimeout(300);
    }
    await dash.sidebarButton('Settings').click();

    await expect(page).toHaveURL(/\/dashboard\/settings/);
  });
});
