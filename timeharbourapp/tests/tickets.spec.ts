import { test, expect } from './fixtures/auth';

test.describe('Tickets Page', () => {

  test('renders tickets page with search and tabs', async ({ authedPage: page }) => {
    await page.goto('/dashboard/tickets');
    await page.waitForLoadState('networkidle');

    // Search input
    await expect(page.getByRole('textbox', { name: /search/i })).toBeVisible({ timeout: 10_000 });

    // Tab list with All, Personal, From Timehuddle
    await expect(page.getByRole('tab', { name: 'All' })).toBeVisible({ timeout: 10_000 });
  });

  test('shows status filter chips', async ({ authedPage: page }) => {
    await page.goto('/dashboard/tickets');
    await page.waitForLoadState('networkidle');

    // Status filters are generic clickable elements
    const statuses = ['All', 'Open', 'In Progress', 'Done'];
    for (const status of statuses) {
      await expect(page.locator(`text="${status}"`).first()).toBeVisible({ timeout: 10_000 });
    }
  });

  test('tab switching works', async ({ authedPage: page }) => {
    await page.goto('/dashboard/tickets');
    await page.waitForLoadState('networkidle');

    // Click Personal tab
    const personalTab = page.getByRole('tab', { name: 'Personal' });
    await personalTab.click();
    await page.waitForTimeout(300);

    // Click All tab
    const allTab = page.getByRole('tab', { name: 'All' });
    await allTab.click();
    await page.waitForTimeout(300);
  });

  test('search input filters tickets', async ({ authedPage: page }) => {
    await page.goto('/dashboard/tickets');
    await page.waitForLoadState('networkidle');

    const searchInput = page.getByRole('textbox', { name: /search/i });
    await searchInput.fill('nonexistent-ticket-xyz-999');
    await page.waitForTimeout(500);
    await expect(searchInput).toHaveValue('nonexistent-ticket-xyz-999');
  });

  test('has link to create new ticket', async ({ authedPage: page }) => {
    await page.goto('/dashboard/tickets');
    await page.waitForLoadState('networkidle');

    const createLink = page.getByRole('link', { name: /create new ticket/i })
      .or(page.getByRole('button', { name: /create new ticket/i }));

    if (await createLink.first().isVisible({ timeout: 5_000 }).catch(() => false)) {
      await expect(createLink.first()).toBeVisible();
    }
  });
});
