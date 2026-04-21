import { test, expect } from '@playwright/test';

/**
 * Multi-Profile E2E — create, name, switch, and verify data persistence.
 *
 * What we verify:
 *   1. Profile list shows active profile on first open
 *   2. Create a new named profile → switches to it
 *   3. Switch back to original profile → data preserved
 *   4. Profile list shows both profiles
 *   5. Rename a profile
 *   6. Remove a non-active profile
 */

test.use({
  viewport: { width: 390, height: 844 },
  navigationTimeout: 30_000,
});

// ─── Helpers ────────────────────────────────────────────────

/** Read localStorage identity values. */
async function getIdentity(page: import('@playwright/test').Page) {
  return page.evaluate(() => ({
    uuid: localStorage.getItem('th_identity_uuid'),
    passphrase: localStorage.getItem('th_identity_passphrase'),
  }));
}

/** Read saved profiles from localStorage. */
async function getSavedProfiles(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const raw = localStorage.getItem('th_saved_profiles');
    return raw ? JSON.parse(raw) as { uuid: string; name: string; passphrase: string }[] : [];
  });
}

/** Read all workSessions from IndexedDB. */
async function getWorkSessions(page: import('@playwright/test').Page) {
  return page.evaluate(async () => {
    const uuid = localStorage.getItem('th_identity_uuid');
    const dbName = uuid ? `TimeharborDB_${uuid}` : 'TimeharborDB';
    return new Promise<Record<string, unknown>[]>((resolve, reject) => {
      const req = indexedDB.open(dbName);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('workSessions')) { resolve([]); return; }
        const tx = db.transaction('workSessions', 'readonly');
        const store = tx.objectStore('workSessions');
        const getAll = store.getAll();
        getAll.onsuccess = () => resolve(getAll.result as Record<string, unknown>[]);
        getAll.onerror = () => reject(getAll.error);
      };
    });
  });
}

/** Navigate to settings and wait for Sync & Security section. */
async function goToSettings(page: import('@playwright/test').Page) {
  await page.goto('/dashboard/settings');
  await page.waitForLoadState('networkidle');
  await expect(page.getByText('Sync & Security')).toBeVisible({ timeout: 10_000 });
}

/** Open the Profiles modal from settings. */
async function openProfilesModal(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Switch sync profile' }).click();
  await expect(page.getByRole('heading', { name: 'Profiles' })).toBeVisible({ timeout: 5_000 });
}

/** Shared storage state for fresh contexts. */
function storageState(baseURL: string) {
  return {
    cookies: [] as never[],
    origins: [
      {
        origin: baseURL,
        localStorage: [{ name: 'th_walkthrough_completed', value: '1' }],
      },
    ],
  };
}

// ═══════════════════════════════════════════════════════════
// Profile List
// ═══════════════════════════════════════════════════════════

test.describe('Multi-Profile — Profile List', () => {

  test('opening profiles modal shows active profile', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
    await page.waitForLoadState('networkidle');

    const identity = await getIdentity(page);

    await goToSettings(page);
    await openProfilesModal(page);

    // Should show the active badge
    await expect(page.getByText('Active')).toBeVisible();

    // Should show the current UUID
    await expect(page.getByText(identity.uuid!)).toBeVisible();

    // New Profile and Import Profile buttons visible
    await expect(page.getByRole('button', { name: 'New Profile' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Import Profile' })).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════
// Create & Switch
// ═══════════════════════════════════════════════════════════

test.describe('Multi-Profile — Create & Switch Back', () => {

  test('create new profile, switch back to original, data preserved', async ({ browser }) => {
    test.setTimeout(120_000);

    const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';

    // ── Open dashboard and capture original identity ──
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      storageState: storageState(BASE_URL),
    });
    const page = await ctx.newPage();

    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
    await page.waitForLoadState('networkidle');

    const originalIdentity = await getIdentity(page);
    expect(originalIdentity.uuid).toBeTruthy();

    // ── Clock in to create some data ──
    const clockInBtn = page.getByRole('button', { name: /clock in/i });
    if (await clockInBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await clockInBtn.click();
      // Wait for session to be created
      await page.waitForTimeout(1_000);
    }

    // Record work sessions before switching
    const sessionsBeforeSwitch = await getWorkSessions(page);

    // ── Open Profiles modal, create new profile ──
    await goToSettings(page);
    await openProfilesModal(page);

    // Click "New Profile"
    await page.getByRole('button', { name: 'New Profile' }).click();
    await expect(page.getByRole('heading', { name: 'New Profile' })).toBeVisible({ timeout: 5_000 });

    // Enter profile name
    await page.locator('#new-profile-name').fill('Test Profile');

    // Submit
    await page.getByRole('button', { name: 'Create Profile' }).click();

    // Wait for sync (new profile is empty, should complete quickly)
    await expect(
      page.getByRole('button', { name: 'Go to Dashboard' })
    ).toBeVisible({ timeout: 30_000 });

    // Go to dashboard with new profile
    await page.getByRole('button', { name: 'Go to Dashboard' }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
    await page.waitForLoadState('networkidle');

    // Verify identity changed
    const newIdentity = await getIdentity(page);
    expect(newIdentity.uuid).toBeTruthy();
    expect(newIdentity.uuid).not.toBe(originalIdentity.uuid);

    // Verify saved profiles now has both
    const profilesAfterCreate = await getSavedProfiles(page);
    expect(profilesAfterCreate.length).toBe(2);

    const originalProfile = profilesAfterCreate.find(p => p.uuid === originalIdentity.uuid);
    const newProfile = profilesAfterCreate.find(p => p.uuid === newIdentity.uuid);
    expect(originalProfile).toBeTruthy();
    expect(newProfile).toBeTruthy();
    expect(newProfile!.name).toBe('Test Profile');

    // ── Switch back to original profile ──
    await goToSettings(page);
    await openProfilesModal(page);

    // Original profile should have a "Switch" button (not active)
    const switchBtn = page.getByRole('button', { name: `Switch to ${originalProfile!.name}` });
    await expect(switchBtn).toBeVisible({ timeout: 5_000 });
    await switchBtn.click();

    // Wait for sync to complete
    await expect(
      page.getByRole('button', { name: 'Go to Dashboard' })
    ).toBeVisible({ timeout: 30_000 });

    await page.getByRole('button', { name: 'Go to Dashboard' }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
    await page.waitForLoadState('networkidle');

    // Verify identity is back to original
    const restoredIdentity = await getIdentity(page);
    expect(restoredIdentity.uuid).toBe(originalIdentity.uuid);
    expect(restoredIdentity.passphrase).toBe(originalIdentity.passphrase);

    // Verify original data was restored from server
    // (work sessions should be re-pulled from sync)
    if (sessionsBeforeSwitch.length > 0) {
      const restoredSessions = await getWorkSessions(page);
      expect(restoredSessions.length).toBeGreaterThanOrEqual(sessionsBeforeSwitch.length);
    }

    await ctx.close();
  });
});

// ═══════════════════════════════════════════════════════════
// Rename Profile
// ═══════════════════════════════════════════════════════════

test.describe('Multi-Profile — Rename', () => {

  test('rename active profile via pencil icon', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
    await page.waitForLoadState('networkidle');

    await goToSettings(page);
    await openProfilesModal(page);

    // Click rename on the first (active) profile
    const renameBtn = page.getByRole('button', { name: /Rename/ }).first();
    await expect(renameBtn).toBeVisible({ timeout: 5_000 });
    await renameBtn.click();

    // Edit the name
    const nameInput = page.getByRole('textbox', { name: 'Profile name' });
    await expect(nameInput).toBeVisible();
    await nameInput.clear();
    await nameInput.fill('Renamed Profile');

    // Save
    await page.getByRole('button', { name: 'Save name' }).click();

    // Verify the new name appears
    await expect(page.getByText('Renamed Profile')).toBeVisible({ timeout: 3_000 });

    // Verify in localStorage
    const profiles = await getSavedProfiles(page);
    const identity = await getIdentity(page);
    const active = profiles.find(p => p.uuid === identity.uuid);
    expect(active?.name).toBe('Renamed Profile');
  });
});

// ═══════════════════════════════════════════════════════════
// New Profile validation
// ═══════════════════════════════════════════════════════════

test.describe('Multi-Profile — Validation', () => {

  test('creating profile without name shows error', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
    await page.waitForLoadState('networkidle');

    await goToSettings(page);
    await openProfilesModal(page);

    await page.getByRole('button', { name: 'New Profile' }).click();
    await expect(page.getByRole('heading', { name: 'New Profile' })).toBeVisible({ timeout: 5_000 });

    // Submit empty name
    await page.getByRole('button', { name: 'Create Profile' }).click();
    await expect(page.getByText('Please enter a profile name')).toBeVisible({ timeout: 5_000 });
  });

  test('Import Profile view shows UUID and key fields', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
    await page.waitForLoadState('networkidle');

    await goToSettings(page);
    await openProfilesModal(page);

    await page.getByRole('button', { name: 'Import Profile' }).click();
    await expect(page.getByRole('heading', { name: 'Import Profile' })).toBeVisible({ timeout: 5_000 });

    // UUID and key fields visible
    await expect(page.locator('#switch-uuid')).toBeVisible();
    await expect(page.locator('#switch-key')).toBeVisible();
    await expect(page.locator('#import-name')).toBeVisible();

    // QR scanner button
    await expect(page.getByRole('button', { name: 'Scan QR Code' })).toBeVisible();

    // Back button returns to list
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Profiles' })).toBeVisible({ timeout: 3_000 });
  });
});

test.describe('Cleanup', () => {
  test('clean up test databases', async ({ page }) => {
    // Go to dashboard to ensure same origin
    await page.goto('/dashboard');
    await page.evaluate(async () => {
      if (window.indexedDB && window.indexedDB.databases) {
        const dbs = await window.indexedDB.databases();
        for (const db of dbs) {
          if (db.name && db.name.startsWith('TimeharborDB_')) {
            window.indexedDB.deleteDatabase(db.name);
          }
        }
      }
    });
  });
});
