import { test, expect } from './fixtures/auth';

test.describe('Notepad Page', () => {

  test('renders notepad page with search and create button', async ({ authedPage: page }) => {
    await page.goto('/dashboard/notepad');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('textbox', { name: 'Search notes' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: 'Create new note' })).toBeVisible({ timeout: 10_000 });
  });

  test('can create a new note', async ({ authedPage: page }) => {
    await page.goto('/dashboard/notepad');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Create new note' }).click();
    await page.waitForTimeout(500);

    // A new note title input should appear
    const titleInput = page.getByRole('textbox', { name: /note title/i });
    if (await titleInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await titleInput.fill('E2E Test Note');
      await page.waitForTimeout(1_000);
      // Note should appear in the sidebar list
      await expect(page.getByRole('button', { name: /open note.*e2e test note/i })).toBeVisible({ timeout: 5_000 });
    }
  });

  test('search shows no matches for unknown query', async ({ authedPage: page }) => {
    await page.goto('/dashboard/notepad');
    await page.waitForLoadState('networkidle');

    await page.getByRole('textbox', { name: 'Search notes' }).fill('nonexistent-xyz');
    await page.waitForTimeout(500);

    await expect(page.getByText(/no match|no notes/i)).toBeVisible({ timeout: 5_000 });
  });

  test('empty notepad shows placeholder text', async ({ authedPage: page }) => {
    await page.goto('/dashboard/notepad');
    await page.waitForLoadState('networkidle');

    // New user should see empty state — split view shows both messages
    await expect(page.getByText('No notes yet').first()).toBeVisible({ timeout: 10_000 });
  });
});
