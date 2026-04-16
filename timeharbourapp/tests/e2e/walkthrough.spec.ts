import { test, expect } from '../fixtures/auth.fixture';

const TOTAL_STEPS = 14;

/**
 * Walkthrough modal selectors scoped to the .wt-overlay dialog.
 */
const wt = {
  overlay: '.wt-overlay',
  tooltip: '.wt-tooltip',
  title: '.wt-title',
  counter: '.wt-counter',
  nextBtn: '.wt-actions button:last-child',
  backBtn: '.wt-actions button:first-child',
  skipBtn: '.wt-skip-btn',
  dots: '.wt-dots',
  dot: '.wt-dot',
  activeDot: '.wt-dot--active',
  progressBar: '.wt-progress-bar',
  spotlight: '[style*="box-shadow"]',
} as const;

test.describe('Walkthrough Tour', () => {
  /**
   * The auth fixture now dismisses the walkthrough for all tests.
   * Re-trigger it by clearing the localStorage flag and reloading.
   */
  async function reopenWalkthrough(page: import('@playwright/test').Page) {
    await page.evaluate(() => localStorage.removeItem('th_walkthrough_completed'));
    await page.reload();
    await page.waitForLoadState('networkidle');
  }

  test('displays walkthrough on first visit', async ({ authedPage: page }) => {
    await reopenWalkthrough(page);
    const overlay = page.locator(wt.overlay);
    await expect(overlay).toBeVisible({ timeout: 15_000 });

    // Step 1 of 14 — Welcome screen (centered, no spotlight)
    await expect(page.locator(wt.title)).toHaveText('Welcome to TimeHarbor!');
    await expect(page.locator(wt.counter)).toHaveText(`Step 1 of ${TOTAL_STEPS}`);
  });

  test('Next button advances through steps', async ({ authedPage: page }) => {
    await reopenWalkthrough(page);
    await expect(page.locator(wt.overlay)).toBeVisible({ timeout: 15_000 });

    // Step 1 — Welcome
    await expect(page.locator(wt.title)).toHaveText('Welcome to TimeHarbor!');

    // Click Next → Step 2
    await page.locator(wt.nextBtn).click();
    await expect(page.locator(wt.counter)).toHaveText(`Step 2 of ${TOTAL_STEPS}`);
    await expect(page.locator(wt.title)).toHaveText('Time Summary');

    // Click Next → Step 3
    await page.locator(wt.nextBtn).click();
    await expect(page.locator(wt.counter)).toHaveText(`Step 3 of ${TOTAL_STEPS}`);
    await expect(page.locator(wt.title)).toHaveText('Clock In & Clock Out');
  });

  test('Back button returns to previous step', async ({ authedPage: page }) => {
    await reopenWalkthrough(page);
    await expect(page.locator(wt.overlay)).toBeVisible({ timeout: 15_000 });

    // Advance to Step 2
    await page.locator(wt.nextBtn).click();
    await expect(page.locator(wt.counter)).toHaveText(`Step 2 of ${TOTAL_STEPS}`);

    // Advance to Step 3
    await page.locator(wt.nextBtn).click();
    await expect(page.locator(wt.counter)).toHaveText(`Step 3 of ${TOTAL_STEPS}`);

    // Back → Step 2
    await page.locator(wt.backBtn).click();
    await expect(page.locator(wt.counter)).toHaveText(`Step 2 of ${TOTAL_STEPS}`);
    await expect(page.locator(wt.title)).toHaveText('Time Summary');
  });

  test('Skip walkthrough closes modal and sets localStorage flag', async ({ authedPage: page }) => {
    await reopenWalkthrough(page);
    await expect(page.locator(wt.overlay)).toBeVisible({ timeout: 15_000 });

    // The skip button is only on Step 1 (Welcome)
    await page.locator(wt.skipBtn).click();

    // Modal should disappear
    await expect(page.locator(wt.overlay)).toBeHidden();

    // localStorage flag should be set
    const flag = await page.evaluate(() => localStorage.getItem('th_walkthrough_completed'));
    expect(flag).toBe('1');
  });

  test('walkthrough does not reappear after completion', async ({ authedPage: page }) => {
    await reopenWalkthrough(page);
    await expect(page.locator(wt.overlay)).toBeVisible({ timeout: 15_000 });

    // Skip to mark as completed
    await page.locator(wt.skipBtn).click();
    await expect(page.locator(wt.overlay)).toBeHidden();

    // Reload the page — walkthrough should NOT reappear
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Give it time to potentially appear (it has an 800ms delay)
    await page.waitForTimeout(1_500);
    await expect(page.locator(wt.overlay)).toBeHidden();
  });

  test('dot navigation jumps to correct step', async ({ authedPage: page }) => {
    await reopenWalkthrough(page);
    await expect(page.locator(wt.overlay)).toBeVisible({ timeout: 15_000 });

    // Click the 4th dot (index 3) → should jump to Step 4
    const dots = page.locator(wt.dot);
    await dots.nth(3).click();
    await expect(page.locator(wt.counter)).toHaveText(`Step 4 of ${TOTAL_STEPS}`);

    // The active dot should be the 4th
    const activeDot = page.locator(wt.activeDot);
    await expect(activeDot).toHaveCount(1);
  });

  test('progress bar advances with each step', async ({ authedPage: page }) => {
    await reopenWalkthrough(page);
    await expect(page.locator(wt.overlay)).toBeVisible({ timeout: 15_000 });

    const bar = page.locator(wt.progressBar);

    // Step 1: ~7% (1/14)
    const width1 = await bar.getAttribute('style');
    expect(width1).toContain('width');

    // Advance to Step 2
    await page.locator(wt.nextBtn).click();
    const width2 = await bar.getAttribute('style');

    // Width should increase
    const parseWidth = (s: string | null) => parseFloat(s?.match(/width:\s*([\d.]+)%/)?.[1] ?? '0');
    expect(parseWidth(width2)).toBeGreaterThan(parseWidth(width1));
  });

  test('completing all steps closes modal', async ({ authedPage: page }) => {
    await reopenWalkthrough(page);
    await expect(page.locator(wt.overlay)).toBeVisible({ timeout: 15_000 });

    // Click through all steps
    for (let i = 0; i < TOTAL_STEPS - 1; i++) {
      await page.locator(wt.nextBtn).click();
      // Brief stabilisation for sidebar open/close transitions
      await page.waitForTimeout(400);
    }

    // Final step should show "Get Started!" button
    await expect(page.locator(wt.nextBtn)).toHaveText('Get Started!');
    await page.locator(wt.nextBtn).click();

    // Modal should close
    await expect(page.locator(wt.overlay)).toBeHidden();

    // Flag stored
    const flag = await page.evaluate(() => localStorage.getItem('th_walkthrough_completed'));
    expect(flag).toBe('1');
  });

  test('spotlight highlights correct dashboard elements', async ({ authedPage: page }) => {
    await reopenWalkthrough(page);
    await expect(page.locator(wt.overlay)).toBeVisible({ timeout: 15_000 });

    // Step 1 — Welcome: centered, no spotlight target
    const tooltip = page.locator(wt.tooltip);
    await expect(tooltip).toHaveClass(/wt-tooltip--centered/);

    // Step 2 — Time Summary: should anchor to an element (spotlight visible)
    await page.locator(wt.nextBtn).click();
    await expect(page.locator(wt.counter)).toHaveText(`Step 2 of ${TOTAL_STEPS}`);
    await expect(tooltip).toHaveClass(/wt-tooltip--anchored/);

    // The dashboard-summary element should exist on this page
    await expect(page.locator('[data-walkthrough="dashboard-summary"]')).toBeVisible();
  });

  test('walkthrough shows mock data during tour', async ({ authedPage: page }) => {
    await reopenWalkthrough(page);
    await expect(page.locator(wt.overlay)).toBeVisible({ timeout: 15_000 });

    // Advance to Time Summary step (step 2)
    await page.locator(wt.nextBtn).click();
    await expect(page.locator(wt.title)).toHaveText('Time Summary');

    // Mock data should show non-zero hours
    const summarySection = page.locator('[data-walkthrough="dashboard-summary"]');
    await expect(summarySection).toBeVisible();
    await expect(summarySection).not.toContainText('0h 0m');
  });

  test('replay walkthrough from settings navigates to dashboard', async ({ authedPage: page }) => {
    // Navigate to Settings (walkthrough already dismissed by fixture)
    await page.goto('/dashboard/settings');
    await page.waitForLoadState('networkidle');

    // Click "Replay Walkthrough"
    await page.getByRole('button', { name: 'Replay app walkthrough' }).click();

    // Should navigate to /dashboard and reopen the walkthrough
    await expect(page).toHaveURL(/\/dashboard\/?$/);
    await expect(page.locator(wt.overlay)).toBeVisible({ timeout: 5_000 });
    await expect(page.locator(wt.title)).toHaveText('Welcome to TimeHarbor!');
  });
});
