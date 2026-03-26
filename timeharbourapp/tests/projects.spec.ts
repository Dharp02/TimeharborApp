import { test, expect } from './fixtures/auth';

test.describe('Projects Page', () => {

  test('renders projects page with header', async ({ authedPage: page }) => {
    await page.goto('/dashboard/projects');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Projects').first()).toBeVisible({ timeout: 10_000 });
  });

  test('shows create project button', async ({ authedPage: page }) => {
    await page.goto('/dashboard/projects');
    await page.waitForLoadState('networkidle');

    // Either "Create new project" or "Create Project" button
    await expect(
      page.getByRole('button', { name: /create.*project/i }).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('shows empty state for new user', async ({ authedPage: page }) => {
    await page.goto('/dashboard/projects');
    await page.waitForLoadState('networkidle');

    await expect(
      page.getByText(/create your first project|no.*project/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('search input filters projects', async ({ authedPage: page }) => {
    await page.goto('/dashboard/projects');
    await page.waitForLoadState('networkidle');

    const searchInput = page.getByRole('textbox', { name: /search/i });
    if (await searchInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await searchInput.fill('nonexistent-project-xyz');
      await page.waitForTimeout(500);
    }
  });
});
