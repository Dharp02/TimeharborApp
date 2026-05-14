import { test, expect, type Page, type Route } from '@playwright/test';

/**
 * TimeHuddle Connection E2E — Settings → TimeHuddle Connection page.
 *
 * All external API calls to /api/v1/timehuddle/* are intercepted via
 * page.route() so tests never depend on a live TimeHuddle instance.
 *
 * What we verify:
 *   1. Settings page lists the TimeHuddle Connection entry and navigates to it
 *   2. Page shows "Not connected" when disconnected
 *   3. Connect form is always visible (for first connect or reconnect)
 *   4. Connect button is disabled when the token field is empty
 *   5. Paste a valid token → API called → connected state shown (name + email)
 *   6. Paste an invalid token → API returns error → error message shown
 *   7. Disconnect button → API called → disconnected state restored
 *   8. After disconnecting, connect form re-appears for a fresh token
 *   9. Reconnect with a new token when already connected
 */

test.use({
  viewport: { width: 390, height: 844 },
  navigationTimeout: 30_000,
});

// ─── Route mock helpers ──────────────────────────────────────

const VALID_TOKEN = 'th_pat_validtokenfortest';
const INVALID_TOKEN = 'th_pat_badtoken';

function mockDisconnected(page: Page) {
  return page.route('**/api/v1/timehuddle/status', (route: Route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ connected: false }) })
  );
}

function mockConnected(page: Page, email = 'alice@timehuddle.io', name = 'Alice Timehuddle') {
  return page.route('**/api/v1/timehuddle/status', (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ connected: true, timehudleEmail: email, timehudleName: name, connectedAt: new Date().toISOString() }),
    })
  );
}

function mockConnectSuccess(page: Page, email = 'alice@timehuddle.io', name = 'Alice Timehuddle') {
  return page.route('**/api/v1/timehuddle/connect', (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ connected: true, timehudleEmail: email, timehudleName: name }),
    })
  );
}

function mockConnectFailure(page: Page, errorMessage = 'Invalid or expired token') {
  return page.route('**/api/v1/timehuddle/connect', (route: Route) =>
    route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({ error: errorMessage }),
    })
  );
}

function mockDisconnectSuccess(page: Page) {
  return page.route('**/api/v1/timehuddle/disconnect', (route: Route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) })
  );
}

// ─── Navigation helpers ──────────────────────────────────────

async function goToTimehuddle(page: Page) {
  await page.goto('/dashboard/settings/timehuddle');
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { name: 'TimeHuddle Connection' })).toBeVisible({ timeout: 10_000 });
}

// ═══════════════════════════════════════════════════════════
// Navigation from Settings list
// ═══════════════════════════════════════════════════════════

test.describe('Settings — TimeHuddle Connection entry', () => {
  test('settings page lists TimeHuddle Connection and navigates to it', async ({ page }) => {
    await mockDisconnected(page);

    await page.goto('/dashboard/settings');
    await page.waitForLoadState('networkidle');

    const entry = page.getByText('TimeHuddle Connection');
    await expect(entry).toBeVisible({ timeout: 10_000 });

    await entry.click();
    await expect(page).toHaveURL(/\/dashboard\/settings\/timehuddle/);
    await expect(page.getByRole('heading', { name: 'TimeHuddle Connection' })).toBeVisible({ timeout: 10_000 });
  });
});

// ═══════════════════════════════════════════════════════════
// Initial disconnected state
// ═══════════════════════════════════════════════════════════

test.describe('Settings — TimeHuddle: disconnected state', () => {
  test('shows "Not connected" status and connect form', async ({ page }) => {
    await mockDisconnected(page);
    await goToTimehuddle(page);

    // Status badge
    await expect(page.getByText('Not connected')).toBeVisible();

    // Connect form heading
    await expect(page.getByText('Connect your TimeHuddle account')).toBeVisible();

    // Token instructions
    await expect(page.getByText(/Settings → API Tokens/)).toBeVisible();

    // Token textarea with correct placeholder
    const tokenInput = page.getByLabel('TimeHuddle personal access token');
    await expect(tokenInput).toBeVisible();
    await expect(tokenInput).toHaveAttribute('placeholder', 'th_pat_…');

    // Connect button visible
    await expect(page.getByRole('button', { name: 'Connect to TimeHuddle' })).toBeVisible();
  });

  test('connect button is disabled when token field is empty', async ({ page }) => {
    await mockDisconnected(page);
    await goToTimehuddle(page);

    const connectBtn = page.getByRole('button', { name: 'Connect to TimeHuddle' });
    await expect(connectBtn).toBeDisabled();
  });

  test('connect button remains disabled for whitespace-only input', async ({ page }) => {
    await mockDisconnected(page);
    await goToTimehuddle(page);

    const tokenInput = page.getByLabel('TimeHuddle personal access token');
    await tokenInput.fill('   ');

    const connectBtn = page.getByRole('button', { name: 'Connect to TimeHuddle' });
    await expect(connectBtn).toBeDisabled();
  });
});

// ═══════════════════════════════════════════════════════════
// Successful connect flow
// ═══════════════════════════════════════════════════════════

test.describe('Settings — TimeHuddle: connect flow', () => {
  test('paste valid token → connects → shows connected state with name and email', async ({ page }) => {
    await mockDisconnected(page);
    await mockConnectSuccess(page);
    await goToTimehuddle(page);

    const tokenInput = page.getByLabel('TimeHuddle personal access token');
    await tokenInput.fill(VALID_TOKEN);

    // Connect button becomes enabled
    const connectBtn = page.getByRole('button', { name: 'Connect to TimeHuddle' });
    await expect(connectBtn).toBeEnabled();

    await connectBtn.click();

    // Connected status panel appears
    await expect(page.getByText('Connected')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Alice Timehuddle')).toBeVisible();
    await expect(page.getByText('alice@timehuddle.io', { exact: true }).first()).toBeVisible();

    // Success feedback message
    await expect(page.getByRole('status')).toContainText('Connected as alice@timehuddle.io');

    // Token field cleared after successful connect
    await expect(tokenInput).toHaveValue('');

    // Disconnect button now visible
    await expect(page.getByRole('button', { name: 'Disconnect' })).toBeVisible();
  });

  test('verify correct POST body is sent to connect endpoint', async ({ page }) => {
    await mockDisconnected(page);

    let capturedBody: Record<string, unknown> | null = null;
    await page.route('**/api/v1/timehuddle/connect', async (route: Route) => {
      capturedBody = JSON.parse(route.request().postData() ?? '{}') as Record<string, unknown>;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ connected: true, timehudleEmail: 'test@th.io', timehudleName: 'Test User' }),
      });
    });

    await goToTimehuddle(page);
    await page.getByLabel('TimeHuddle personal access token').fill(VALID_TOKEN);
    await page.getByRole('button', { name: 'Connect to TimeHuddle' }).click();

    await expect(page.getByText('Connected')).toBeVisible({ timeout: 10_000 });
    expect(capturedBody).toEqual({ token: VALID_TOKEN });
  });
});

// ═══════════════════════════════════════════════════════════
// Error handling
// ═══════════════════════════════════════════════════════════

test.describe('Settings — TimeHuddle: connection error', () => {
  test('invalid token shows error message from API', async ({ page }) => {
    await mockDisconnected(page);
    await mockConnectFailure(page, 'Invalid or expired token');
    await goToTimehuddle(page);

    await page.getByLabel('TimeHuddle personal access token').fill(INVALID_TOKEN);
    await page.getByRole('button', { name: 'Connect to TimeHuddle' }).click();

    // Error feedback visible
    const statusMsg = page.getByRole('status');
    await expect(statusMsg).toBeVisible({ timeout: 10_000 });
    await expect(statusMsg).toContainText('Invalid or expired token');

    // Status still shows not connected
    await expect(page.getByText('Not connected')).toBeVisible();

    // Connect button re-enabled so user can retry
    await expect(page.getByRole('button', { name: 'Connect to TimeHuddle' })).toBeEnabled();
  });

  test('network error shows generic fallback error message', async ({ page }) => {
    await mockDisconnected(page);

    await page.route('**/api/v1/timehuddle/connect', (route: Route) => route.abort('failed'));
    await goToTimehuddle(page);

    await page.getByLabel('TimeHuddle personal access token').fill(VALID_TOKEN);
    await page.getByRole('button', { name: 'Connect to TimeHuddle' }).click();

    const statusMsg = page.getByRole('status');
    await expect(statusMsg).toBeVisible({ timeout: 10_000 });
    // Some error message should appear (not empty)
    const text = await statusMsg.textContent();
    expect(text?.trim().length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════
// Disconnect flow
// ═══════════════════════════════════════════════════════════

test.describe('Settings — TimeHuddle: disconnect flow', () => {
  test('already connected → disconnect → shows disconnected state', async ({ page }) => {
    await mockConnected(page);
    await mockDisconnectSuccess(page);
    await goToTimehuddle(page);

    // Verify connected state loaded
    await expect(page.getByText('Connected')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Alice Timehuddle')).toBeVisible();
    await expect(page.getByText('alice@timehuddle.io')).toBeVisible();

    // Click disconnect
    await page.getByRole('button', { name: 'Disconnect' }).click();

    // Disconnected state appears
    await expect(page.getByText('Not connected')).toBeVisible({ timeout: 10_000 });

    // Success feedback
    await expect(page.getByRole('status')).toContainText('Disconnected from TimeHuddle');

    // Connect form re-appears with original heading
    await expect(page.getByText('Connect your TimeHuddle account')).toBeVisible();
  });

  test('verify DELETE request sent to disconnect endpoint', async ({ page }) => {
    await mockConnected(page);

    let disconnectMethod: string | null = null;
    await page.route('**/api/v1/timehuddle/disconnect', async (route: Route) => {
      disconnectMethod = route.request().method();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
    });

    await goToTimehuddle(page);
    await expect(page.getByText('Connected')).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Disconnect' }).click();

    await expect(page.getByText('Not connected')).toBeVisible({ timeout: 10_000 });
    expect(disconnectMethod).toBe('DELETE');
  });
});

// ═══════════════════════════════════════════════════════════
// Already connected state rendering
// ═══════════════════════════════════════════════════════════

test.describe('Settings — TimeHuddle: already connected state', () => {
  test('shows "Connected" badge, name, email, and connected-since date', async ({ page }) => {
    await mockConnected(page);
    await goToTimehuddle(page);

    await expect(page.getByText('Connected')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Alice Timehuddle')).toBeVisible();
    await expect(page.getByText('alice@timehuddle.io')).toBeVisible();
    await expect(page.getByText(/Since/)).toBeVisible();
  });

  test('reconnect form shows "Reconnect with a new token" heading when connected', async ({ page }) => {
    await mockConnected(page);
    await goToTimehuddle(page);

    await expect(page.getByText('Connected')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Reconnect with a new token')).toBeVisible();
  });

  test('can reconnect with a new token while already connected', async ({ page }) => {
    await mockConnected(page);
    await mockConnectSuccess(page, 'bob@timehuddle.io', 'Bob Timehuddle');
    await goToTimehuddle(page);

    await expect(page.getByText('Connected')).toBeVisible({ timeout: 10_000 });

    // Fill in a new token and reconnect
    const tokenInput = page.getByLabel('TimeHuddle personal access token');
    await tokenInput.fill('th_pat_newreplacementtoken');
    await page.getByRole('button', { name: 'Connect to TimeHuddle' }).click();

    // New account details reflected
    await expect(page.getByText('Bob Timehuddle')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('bob@timehuddle.io', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('status')).toContainText('Connected as bob@timehuddle.io');
  });
});

// ═══════════════════════════════════════════════════════════
// Back navigation
// ═══════════════════════════════════════════════════════════

test.describe('Settings — TimeHuddle: navigation', () => {
  test('back button navigates away from the page', async ({ page }) => {
    await mockDisconnected(page);
    await page.goto('/dashboard/settings');
    await page.waitForLoadState('networkidle');
    await page.goto('/dashboard/settings/timehuddle');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'TimeHuddle Connection' })).toBeVisible({ timeout: 10_000 });

    await page.getByRole('main').getByRole('button', { name: 'Go back' }).click();

    // Should have navigated away from the timehuddle page
    await expect(page).not.toHaveURL(/\/dashboard\/settings\/timehuddle/);
  });
});
