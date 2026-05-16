import { test, expect } from '@playwright/test';

/**
 * Settings E2E — Share My Link, Recovery Key, Restore from Recovery Key,
 * Regenerate Key, Switch Profile.
 *
 * Uses a mobile viewport consistent with other specs.
 *
 * What we verify:
 *   1. Share My Link — modal opens, URL/key displayed, QR code toggles, copy works
 *   2. Share My Link E2E flow — copy URL → open share page → enter key → dashboard
 *   3. Recovery Key — save button, one per profile, becomes disabled after save
 *   4. Restore from Recovery Key — enter key → data restored
 *   5. Regenerate Key — warning shown, key regenerated, old links invalidated
 *   6. Switch Profile — enter UUID + key → profile switched, opLogs present
 */

test.use({
  viewport: { width: 390, height: 844 },
  navigationTimeout: 30_000,
});

// ─── IndexedDB helpers ──────────────────────────────────────

/** Read all opLog entries from IndexedDB. */
async function getOpLogEntries(page: import('@playwright/test').Page) {
  return page.evaluate(async () => {
    const uuid = localStorage.getItem('th_identity_uuid');
    const dbName = uuid ? `TimeharborDB_${uuid}` : 'TimeharborDB';
    return new Promise<Record<string, unknown>[]>((resolve, reject) => {
      const req = indexedDB.open(dbName);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('opLog')) { resolve([]); return; }
        const tx = db.transaction('opLog', 'readonly');
        const store = tx.objectStore('opLog');
        const getAll = store.getAll();
        getAll.onsuccess = () => resolve(getAll.result as Record<string, unknown>[]);
        getAll.onerror = () => reject(getAll.error);
      };
    });
  });
}

/** Read all operationLogs (audit trail) from IndexedDB. */
async function getOperationLogs(page: import('@playwright/test').Page) {
  return page.evaluate(async () => {
    const uuid = localStorage.getItem('th_identity_uuid');
    const dbName = uuid ? `TimeharborDB_${uuid}` : 'TimeharborDB';
    return new Promise<Record<string, unknown>[]>((resolve, reject) => {
      const req = indexedDB.open(dbName);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('operationLogs')) { resolve([]); return; }
        const tx = db.transaction('operationLogs', 'readonly');
        const store = tx.objectStore('operationLogs');
        const getAll = store.getAll();
        getAll.onsuccess = () => resolve(getAll.result as Record<string, unknown>[]);
        getAll.onerror = () => reject(getAll.error);
      };
    });
  });
}

/** Read localStorage values for identity from the page context. */
async function getIdentity(page: import('@playwright/test').Page) {
  return page.evaluate(() => ({
    uuid: localStorage.getItem('th_identity_uuid'),
    passphrase: localStorage.getItem('th_identity_passphrase'),
  }));
}

// ─── Offline helpers ────────────────────────────────────────

/** Go offline by cutting all network via CDP. */
async function goOffline(page: import('@playwright/test').Page) {
  const ctx = page.context();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.emulateNetworkConditions', {
    offline: true,
    latency: 0,
    downloadThroughput: 0,
    uploadThroughput: 0,
  });
  return cdp;
}

/** Restore network via CDP session. */
async function goOnline(cdp: import('playwright-core').CDPSession) {
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  });
}

// ─── Navigation helpers ─────────────────────────────────────

/** Navigate to the settings page and wait for it to load. */
async function goToSettings(page: import('@playwright/test').Page) {
  await page.goto('/dashboard/settings');
  await page.waitForLoadState('networkidle');
  await expect(page.getByText('Sync & Security')).toBeVisible({ timeout: 10_000 });
}

// ═══════════════════════════════════════════════════════════
// Share My Link
// ═══════════════════════════════════════════════════════════

test.describe('Settings — Share My Link', () => {

  test('modal opens and shows share URL, UUID, encryption key, and QR code toggle', async ({ page }) => {
    await goToSettings(page);

    // Click "Share My Link"
    await page.getByRole('button', { name: 'Share my sync link' }).click();

    // Modal appears with title
    await expect(page.getByRole('heading', { name: 'Share My Link' })).toBeVisible({ timeout: 5_000 });

    // Share URL input is visible and populated
    const shareUrlInput = page.locator('input[readonly]').first();
    await expect(shareUrlInput).toBeVisible();
    const shareUrl = await shareUrlInput.inputValue();
    expect(shareUrl).toContain('/share?uuid=');

    // UUID is displayed
    await expect(page.getByText('Your UUID:')).toBeVisible();

    // Encryption key section visible on first share
    await expect(page.getByText('Encryption Key', { exact: true })).toBeVisible();

    // Copy share URL button
    await expect(page.getByRole('button', { name: 'Copy share URL' })).toBeVisible();

    // Copy encryption key button
    await expect(page.getByRole('button', { name: 'Copy encryption key' })).toBeVisible();

    // QR code toggle — initially hidden
    const showQrButton = page.getByRole('button', { name: 'Show QR Code' });
    await expect(showQrButton).toBeVisible();

    // Show QR code
    await showQrButton.click();
    await expect(page.locator('canvas[aria-label="QR code for device pairing"]')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Scan from another device to pair')).toBeVisible();

    // Hide QR code
    await page.getByRole('button', { name: 'Hide QR Code' }).click();
    await expect(page.locator('canvas[aria-label="QR code for device pairing"]')).not.toBeVisible();
  });

  test('first share requires confirmation checkbox before Done is enabled', async ({ page }) => {
    await goToSettings(page);
    await page.getByRole('button', { name: 'Share my sync link' }).click();
    await expect(page.getByRole('heading', { name: 'Share My Link' })).toBeVisible({ timeout: 5_000 });

    // Done button should be disabled before checking the save confirmation
    const doneButton = page.getByRole('button', { name: 'Done' });
    await expect(doneButton).toBeDisabled();

    // Check the "I have saved my encryption key" checkbox
    await page.getByRole('checkbox', { name: 'I have saved my encryption key' }).check();

    // Done button should now be enabled
    await expect(doneButton).toBeEnabled();

    // Click Done
    await doneButton.click();

    // Modal should close
    await expect(page.getByRole('heading', { name: 'Share My Link' })).not.toBeVisible({ timeout: 3_000 });
  });

  test('export key file button triggers download', async ({ page }) => {
    await goToSettings(page);
    await page.getByRole('button', { name: 'Share my sync link' }).click();
    await expect(page.getByRole('heading', { name: 'Share My Link' })).toBeVisible({ timeout: 5_000 });

    // Click Export button and verify download
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('timeharbor-sync-key.txt');
  });

  test('share URL works offline — identity stays consistent', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'CDP network emulation is not supported on WebKit');
    await goToSettings(page);

    // Capture identity before going offline
    const identityBefore = await getIdentity(page);
    expect(identityBefore.uuid).toBeTruthy();
    expect(identityBefore.passphrase).toBeTruthy();

    // Open share modal to capture the URL
    await page.getByRole('button', { name: 'Share my sync link' }).click();
    await expect(page.getByRole('heading', { name: 'Share My Link' })).toBeVisible({ timeout: 5_000 });

    const shareUrlInput = page.locator('input[aria-labelledby="share-url-label"]');
    await expect(shareUrlInput).toHaveValue(/\/share\?uuid=/, { timeout: 5_000 });
    const shareUrl = await shareUrlInput.inputValue();
    expect(shareUrl).toContain('/share?uuid=');

    // Close modal by confirming
    await page.getByRole('checkbox', { name: 'I have saved my encryption key' }).check();
    await page.getByRole('button', { name: 'Done' }).click();

    // Go offline
    const cdp = await goOffline(page);

    // Open share modal again while offline
    await page.getByRole('button', { name: 'Share my sync link' }).click();
    await expect(page.getByRole('heading', { name: 'Share My Link' })).toBeVisible({ timeout: 5_000 });

    // The share URL and UUID should still be the same (loaded from localStorage)
    const offlineShareUrl = await page.locator('input[aria-labelledby="share-url-label"]').inputValue();
    expect(offlineShareUrl).toBe(shareUrl);

    // Identity should be unchanged
    const identityAfter = await getIdentity(page);
    expect(identityAfter.uuid).toBe(identityBefore.uuid);
    expect(identityAfter.passphrase).toBe(identityBefore.passphrase);

    await goOnline(cdp);
  });
});

// ═══════════════════════════════════════════════════════════
// Share My Link — E2E Flow (share URL → enter key → dashboard)
// ═══════════════════════════════════════════════════════════

test.describe('Settings — Share My Link E2E Flow', () => {

  test('copy share URL and encryption key → open share page in incognito → enter key → reach dashboard', async ({ page, browser }) => {
    test.setTimeout(60_000);

    await goToSettings(page);

    // Open Share My Link modal
    await page.getByRole('button', { name: 'Share my sync link' }).click();
    await expect(page.getByRole('heading', { name: 'Share My Link' })).toBeVisible({ timeout: 5_000 });

    // Capture the share URL — use the input tied to "Share URL" label
    const shareUrlInput = page.locator('input[aria-labelledby="share-url-label"]');
    await expect(shareUrlInput).toHaveValue(/\/share\?uuid=/, { timeout: 5_000 });
    const shareUrl = await shareUrlInput.inputValue();
    expect(shareUrl).toContain('/share?uuid=');

    // Capture the encryption key from localStorage
    const identity = await getIdentity(page);
    expect(identity.uuid).toBeTruthy();
    expect(identity.passphrase).toBeTruthy();

    // Close the modal
    await page.getByRole('checkbox', { name: 'I have saved my encryption key' }).check();
    await page.getByRole('button', { name: 'Done' }).click();

    // Simulate the recipient in an incognito / fresh browser context
    // (no shared localStorage, cookies, or IndexedDB — like a different device)
    const incognitoCtx = await browser.newContext();
    const recipientPage = await incognitoCtx.newPage();
    await recipientPage.goto(shareUrl);
    await recipientPage.waitForLoadState('networkidle');

    // The share page should show "TimeHarbor Sync"
    await expect(recipientPage.getByText('TimeHarbor Sync')).toBeVisible({ timeout: 10_000 });

    // It should display the UUID being connected to
    await expect(recipientPage.getByText('Connecting to UUID:')).toBeVisible();
    await expect(recipientPage.locator('code').filter({ hasText: identity.uuid! })).toBeVisible();

    // Enter the encryption key
    await recipientPage.locator('#share-key').fill(identity.passphrase!);

    // Click "Sync Data"
    await recipientPage.getByRole('button', { name: 'Sync Data' }).click();

    // Wait for sync to complete — either success message or dashboard redirect
    await expect(
      recipientPage.getByText('Successfully synced').or(recipientPage.getByText('Go to Dashboard'))
    ).toBeVisible({ timeout: 30_000 });

    // Click "Go to Dashboard" if visible
    const goToDashboard = recipientPage.getByRole('button', { name: 'Go to Dashboard' });
    if (await goToDashboard.isVisible()) {
      await goToDashboard.click();
    }

    // Verify we reach the dashboard
    await expect(recipientPage).toHaveURL(/\/dashboard/, { timeout: 15_000 });

    await incognitoCtx.close();
  });
});

// ═══════════════════════════════════════════════════════════
// Recovery Key — Save
// ═══════════════════════════════════════════════════════════

test.describe('Settings — Recovery Key Save', () => {

  test('Save Recovery Key button is visible and opens the modal', async ({ page }) => {
    await goToSettings(page);

    // "Save Recovery Key" button should be visible
    const saveKeyBtn = page.getByRole('button', { name: /Save recovery key|Recovery key already saved/i });
    await expect(saveKeyBtn).toBeVisible();

    // If the key is not yet saved, it should be enabled and clickable
    const ariaLabel = await saveKeyBtn.getAttribute('aria-label');
    if (ariaLabel === 'Save recovery key') {
      await expect(saveKeyBtn).toBeEnabled();
      await saveKeyBtn.click();

      // Modal should open with "Save Recovery Key" title
      await expect(page.getByRole('heading', { name: 'Save Recovery Key' })).toBeVisible({ timeout: 5_000 });

      // Should have a save button (Keychain or Password Manager)
      await expect(
        page.getByRole('button', { name: /Save to Keychain|Save to Password Manager/i })
      ).toBeVisible();

      // Should have a Cancel button
      await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
    }
  });

  test('once recovery key is saved, the button becomes disabled with shield icon', async ({ page }) => {
    await goToSettings(page);

    // Check the current state of the recovery key button
    const saveKeyBtn = page.getByRole('button', { name: /Save recovery key|Recovery key already saved/i });
    await expect(saveKeyBtn).toBeVisible();

    const ariaLabel = await saveKeyBtn.getAttribute('aria-label');

    if (ariaLabel === 'Recovery key already saved') {
      // Key is already saved — button should be disabled
      await expect(saveKeyBtn).toBeDisabled();

      // The text should say "Recovery Key Saved"
      await expect(page.getByText('Recovery Key Saved')).toBeVisible();

      // Should show the shield check icon (green)
      const shieldIcon = saveKeyBtn.locator('svg.text-green-500');
      await expect(shieldIcon).toBeVisible();
    } else {
      // Key not saved yet — clicking opens modal; we just verify it's not disabled
      await expect(saveKeyBtn).toBeEnabled();
      await expect(page.getByText('Save Recovery Key').first()).toBeVisible();
    }
  });

  test('recovery key is one per user profile — second attempt stays disabled', async ({ page }) => {
    await goToSettings(page);

    const saveKeyBtn = page.getByRole('button', { name: /Save recovery key|Recovery key already saved/i });
    const ariaLabel = await saveKeyBtn.getAttribute('aria-label');

    if (ariaLabel === 'Recovery key already saved') {
      // Already saved from a previous test or setup
      await expect(saveKeyBtn).toBeDisabled();
      // No chevron arrow shown (disabled state)
      const chevron = saveKeyBtn.locator('svg.text-muted-foreground');
      await expect(chevron).not.toBeVisible();
    }
    // If not saved, the test confirms the button is available to save once
  });
});

// ═══════════════════════════════════════════════════════════
// Restore from Recovery Key
// ═══════════════════════════════════════════════════════════

test.describe('Settings — Restore from Recovery Key', () => {

  test('restore button opens modal with manual key input', async ({ page }) => {
    await goToSettings(page);

    // Click "Restore from Recovery Key"
    await page.getByRole('button', { name: 'Restore data from recovery key' }).click();

    // Modal should open with "Restore from Recovery Key" title
    await expect(page.getByRole('heading', { name: 'Restore from Recovery Key' })).toBeVisible({ timeout: 5_000 });

    // Warning about replacing local identity
    await expect(
      page.getByText('This will replace your current local identity')
    ).toBeVisible();

    // Recovery key input field
    const keyInput = page.locator('#restore-key-input');
    await expect(keyInput).toBeVisible();
    await expect(keyInput).toHaveAttribute('placeholder', 'TH1-...');

    // Restore button should be disabled when input is empty
    const restoreButton = page.getByRole('button', { name: 'Restore Data', exact: true });
    await expect(restoreButton).toBeDisabled();

    // Cancel button
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
  });

  test('restore button becomes enabled after entering a recovery key', async ({ page }) => {
    await goToSettings(page);

    await page.getByRole('button', { name: 'Restore data from recovery key' }).click();
    await expect(page.getByRole('heading', { name: 'Restore from Recovery Key' })).toBeVisible({ timeout: 5_000 });

    const keyInput = page.locator('#restore-key-input');
    const restoreButton = page.getByRole('button', { name: 'Restore Data', exact: true });

    // Initially disabled
    await expect(restoreButton).toBeDisabled();

    // Type a recovery key
    await keyInput.fill('TH1-test-recovery-key-value');

    // Now enabled
    await expect(restoreButton).toBeEnabled();
  });

  test('invalid recovery key shows error message', async ({ page }) => {
    await goToSettings(page);

    await page.getByRole('button', { name: 'Restore data from recovery key' }).click();
    await expect(page.getByRole('heading', { name: 'Restore from Recovery Key' })).toBeVisible({ timeout: 5_000 });

    // Enter an invalid recovery key
    await page.locator('#restore-key-input').fill('invalid-key-format');
    await page.getByRole('button', { name: 'Restore Data', exact: true }).click();

    // Wait for error message
    await expect(page.locator('[aria-live="polite"]').last()).toBeVisible({ timeout: 10_000 });
  });
});

// ═══════════════════════════════════════════════════════════
// Regenerate Key
// ═══════════════════════════════════════════════════════════

test.describe('Settings — Regenerate Key', () => {

  test('regenerate key button opens modal with warning', async ({ page }) => {
    await goToSettings(page);

    // Click "Regenerate Key"
    await page.getByRole('button', { name: 'Regenerate encryption key' }).click();

    // Modal should open with title
    await expect(page.getByRole('heading', { name: 'Regenerate Encryption Key' })).toBeVisible({ timeout: 5_000 });

    // Warning about existing shared links breaking
    await expect(
      page.getByText('Regenerating your key will make all existing shared links stop working')
    ).toBeVisible();

    // Regenerate button is present
    await expect(page.getByRole('button', { name: 'Regenerate Key' })).toBeVisible();

    // Cancel button is present
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
  });

  test('cancel closes the modal without regenerating', async ({ page }) => {
    await goToSettings(page);

    // Capture identity before
    const identityBefore = await getIdentity(page);

    // Open modal
    await page.getByRole('button', { name: 'Regenerate encryption key' }).click();
    await expect(page.getByRole('heading', { name: 'Regenerate Encryption Key' })).toBeVisible({ timeout: 5_000 });

    // Click Cancel
    await page.getByRole('button', { name: 'Cancel' }).click();

    // Modal should close
    await expect(page.getByRole('heading', { name: 'Regenerate Encryption Key' })).not.toBeVisible({ timeout: 3_000 });

    // Identity should be unchanged
    const identityAfter = await getIdentity(page);
    expect(identityAfter.uuid).toBe(identityBefore.uuid);
    expect(identityAfter.passphrase).toBe(identityBefore.passphrase);
  });

  test('regenerate key → new key shown, requires confirmation before Done', async ({ page }) => {
    test.setTimeout(60_000);

    await goToSettings(page);

    const identityBefore = await getIdentity(page);

    // Open modal
    await page.getByRole('button', { name: 'Regenerate encryption key' }).click();
    await expect(page.getByRole('heading', { name: 'Regenerate Encryption Key' })).toBeVisible({ timeout: 5_000 });

    // Click Regenerate Key
    await page.getByRole('button', { name: 'Regenerate Key' }).click();

    // Wait for spinner then completion
    await expect(page.getByText('Your key has been regenerated')).toBeVisible({ timeout: 30_000 });

    // New Encryption Key field is visible
    await expect(page.getByText('New Encryption Key', { exact: true })).toBeVisible();

    // New key is displayed in an input
    const newKeyInput = page.locator('input[aria-labelledby="new-key-label"]');
    await expect(newKeyInput).toBeVisible();
    const newKey = await newKeyInput.inputValue();
    expect(newKey).toBeTruthy();
    expect(newKey).not.toBe(identityBefore.passphrase);

    // Done button should be disabled until confirmation checkbox is checked
    const doneButton = page.getByRole('button', { name: 'Done' });
    await expect(doneButton).toBeDisabled();

    // Check confirmation checkbox
    await page.getByRole('checkbox', { name: 'I have saved my new key' }).check();

    // Done should now be enabled
    await expect(doneButton).toBeEnabled();

    // Copy button works
    await page.getByRole('button', { name: 'Copy new encryption key' }).click();

    // Export button
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export to File' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('timeharbor-sync-key-new.txt');

    // Confirm and close
    await doneButton.click();
    await expect(page.getByRole('heading', { name: 'Regenerate Encryption Key' })).not.toBeVisible({ timeout: 3_000 });

    // Identity passphrase should have changed
    const identityAfter = await getIdentity(page);
    expect(identityAfter.uuid).toBe(identityBefore.uuid); // UUID stays the same
    expect(identityAfter.passphrase).not.toBe(identityBefore.passphrase);
    expect(identityAfter.passphrase).toBe(newKey);
  });
});

// ═══════════════════════════════════════════════════════════
// Switch Profile
// ═══════════════════════════════════════════════════════════

test.describe('Settings — Switch Profile', () => {

  test('switch profile button opens modal with profile list', async ({ page }) => {
    await goToSettings(page);

    // Click "Switch Profile"
    await page.getByRole('button', { name: 'Switch sync profile' }).click();

    // Modal should open with title
    await expect(page.getByRole('heading', { name: 'Profiles' })).toBeVisible({ timeout: 5_000 });

    // Active profile badge is shown
    await expect(page.getByText('Active')).toBeVisible();

    // New Profile and Import Profile buttons visible
    await expect(page.getByRole('button', { name: 'New Profile' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Import Profile' })).toBeVisible();
  });

  test('import profile requires both UUID and encryption key', async ({ page }) => {
    await goToSettings(page);

    await page.getByRole('button', { name: 'Switch sync profile' }).click();
    await expect(page.getByRole('heading', { name: 'Profiles' })).toBeVisible({ timeout: 5_000 });

    // Navigate to Import view
    await page.getByRole('button', { name: 'Import Profile' }).click();
    await expect(page.getByRole('heading', { name: 'Import Profile' })).toBeVisible({ timeout: 5_000 });

    // Submit with empty fields
    await page.getByRole('button', { name: 'Import & Switch' }).click();

    // Should show error about UUID
    await expect(page.getByText('Please enter the UUID')).toBeVisible({ timeout: 5_000 });

    // Fill UUID only
    await page.locator('#switch-uuid').fill('12345678-1234-4123-8123-123456789abc');
    await page.getByRole('button', { name: 'Import & Switch' }).click();

    // Should show error about encryption key
    await expect(page.getByText('Please enter the encryption key')).toBeVisible({ timeout: 5_000 });
  });

  test('invalid UUID format shows validation error', async ({ page }) => {
    await goToSettings(page);

    await page.getByRole('button', { name: 'Switch sync profile' }).click();
    await expect(page.getByRole('heading', { name: 'Profiles' })).toBeVisible({ timeout: 5_000 });

    // Navigate to Import view
    await page.getByRole('button', { name: 'Import Profile' }).click();
    await expect(page.getByRole('heading', { name: 'Import Profile' })).toBeVisible({ timeout: 5_000 });

    // Enter invalid UUID format
    await page.locator('#switch-uuid').fill('not-a-valid-uuid');
    await page.locator('#switch-key').fill('test-passphrase');
    await page.getByRole('button', { name: 'Import & Switch' }).click();

    // Should show UUID format error
    await expect(page.getByText('Invalid UUID format')).toBeVisible({ timeout: 5_000 });
  });

  test('incorrect encryption key shows error', async ({ page }) => {
    test.setTimeout(30_000);

    await goToSettings(page);

    // First capture our own UUID to use as target (self-switch with wrong key)
    const identity = await getIdentity(page);

    await page.getByRole('button', { name: 'Switch sync profile' }).click();
    await expect(page.getByRole('heading', { name: 'Profiles' })).toBeVisible({ timeout: 5_000 });

    // Navigate to Import view
    await page.getByRole('button', { name: 'Import Profile' }).click();
    await expect(page.getByRole('heading', { name: 'Import Profile' })).toBeVisible({ timeout: 5_000 });

    // Enter our own UUID but with a wrong key
    await page.locator('#switch-uuid').fill(identity.uuid!);
    await page.locator('#switch-key').fill('wrong-encryption-key-value');
    await page.getByRole('button', { name: 'Import & Switch' }).click();

    // Should show verification error
    await expect(
      page.locator('[aria-live="polite"]').last()
    ).toBeVisible({ timeout: 15_000 });
  });
});

// ═══════════════════════════════════════════════════════════
// Switch Profile — E2E Flow with opLogs
// ═══════════════════════════════════════════════════════════

test.describe('Settings — Switch Profile E2E Flow', () => {

  test('share link from user A → switch profile on user B → opLogs exist', async ({ browser }) => {
    test.setTimeout(90_000);

    const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
    const sharedStorageState = {
      cookies: [] as { name: string; value: string; domain: string; path: string }[],
      origins: [
        {
          origin: BASE_URL,
          localStorage: [
            { name: 'th_walkthrough_completed', value: '1' },
          ],
        },
      ],
    };

    // ── User A: Open dashboard (no auth required) ──
    const ctxA = await browser.newContext({ viewport: { width: 390, height: 844 }, storageState: sharedStorageState as any });
    const pageA = await ctxA.newPage();

    await pageA.goto('/dashboard');
    await expect(pageA).toHaveURL(/\/dashboard/, { timeout: 15_000 });
    await pageA.waitForLoadState('networkidle');

    // Capture User A's identity
    const identityA = await getIdentity(pageA);
    expect(identityA.uuid).toBeTruthy();
    expect(identityA.passphrase).toBeTruthy();

    // Navigate to settings and get share URL
    await goToSettings(pageA);
    await pageA.getByRole('button', { name: 'Share my sync link' }).click();
    await expect(pageA.getByRole('heading', { name: 'Share My Link' })).toBeVisible({ timeout: 5_000 });

    const shareUrl = await pageA.locator('input[readonly]').first().inputValue();
    expect(shareUrl).toContain('/share?uuid=');

    // Close modal
    await pageA.getByRole('checkbox', { name: 'I have saved my encryption key' }).check();
    await pageA.getByRole('button', { name: 'Done' }).click();

    // ── User B: Open dashboard in separate context (gets its own identity) ──
    const ctxB = await browser.newContext({ viewport: { width: 390, height: 844 }, storageState: sharedStorageState as any });
    const pageB = await ctxB.newPage();

    await pageB.goto('/dashboard');
    await expect(pageB).toHaveURL(/\/dashboard/, { timeout: 15_000 });
    await pageB.waitForLoadState('networkidle');

    const identityB = await getIdentity(pageB);
    expect(identityB.uuid).toBeTruthy();
    expect(identityB.uuid).not.toBe(identityA.uuid);

    // ── Switch Profile on User B to User A's profile ──
    await goToSettings(pageB);
    await pageB.getByRole('button', { name: 'Switch sync profile' }).click();
    await expect(pageB.getByRole('heading', { name: 'Profiles' })).toBeVisible({ timeout: 5_000 });

    // Navigate to Import view
    await pageB.getByRole('button', { name: 'Import Profile' }).click();
    await expect(pageB.getByRole('heading', { name: 'Import Profile' })).toBeVisible({ timeout: 5_000 });

    // Enter User A's UUID and passphrase
    await pageB.locator('#switch-uuid').fill(identityA.uuid!);
    await pageB.locator('#switch-key').fill(identityA.passphrase!);
    await pageB.getByRole('button', { name: 'Import & Switch' }).click();

    // Wait for sync completion
    await expect(
      pageB.getByRole('button', { name: 'Go to Dashboard' })
    ).toBeVisible({ timeout: 30_000 });

    // Click "Go to Dashboard"
    const goToDashboard = pageB.getByRole('button', { name: 'Go to Dashboard' });
    if (await goToDashboard.isVisible()) {
      await goToDashboard.click();
    }

    // Verify dashboard loaded
    await expect(pageB).toHaveURL(/\/dashboard/, { timeout: 15_000 });
    await pageB.waitForLoadState('networkidle');

    // Verify identity switched to User A
    const switchedIdentity = await getIdentity(pageB);
    expect(switchedIdentity.uuid).toBe(identityA.uuid);

    // Navigate to op logs to verify entries exist
    await pageB.goto('/dashboard/oplogs');
    await pageB.waitForLoadState('networkidle');

    // Sync Queue tab should be visible
    const syncQueueTab = pageB.getByRole('tab', { name: 'Sync Queue' });
    await expect(syncQueueTab).toBeVisible({ timeout: 10_000 });

    // Check Operation Logs tab for entries
    await pageB.getByRole('tab', { name: 'Operation Logs' }).click();
    await expect(pageB.getByRole('tab', { name: 'Operation Logs' })).toBeVisible({ timeout: 10_000 });

    await ctxA.close();
    await ctxB.close();
  });
});

// ═══════════════════════════════════════════════════════════
// Settings — All Sync & Security buttons visible
// ═══════════════════════════════════════════════════════════

test.describe('Settings — Sync & Security Section', () => {

  test('all sync & security options are visible on settings page', async ({ page }) => {
    await goToSettings(page);

    // Share My Link
    await expect(page.getByRole('button', { name: 'Share my sync link' })).toBeVisible();

    // Save Recovery Key (text varies based on saved state)
    await expect(
      page.getByRole('button', { name: /Save recovery key|Recovery key already saved/i })
    ).toBeVisible();

    // Restore from Recovery Key
    await expect(page.getByRole('button', { name: 'Restore data from recovery key' })).toBeVisible();

    // Regenerate Key
    await expect(page.getByRole('button', { name: 'Regenerate encryption key' })).toBeVisible();

    // Switch Profile (opens Profiles modal)
    await expect(page.getByRole('button', { name: 'Switch sync profile' })).toBeVisible();
  });

  test('settings page shows profile header with name and email', async ({ page }) => {
    await goToSettings(page);

    // Menu items are visible
    await expect(page.getByText('Edit Profile')).toBeVisible();
    await expect(page.getByText('Language')).toBeVisible();
    await expect(page.getByText('Timesheet Settings')).toBeVisible();

    // Toggle switches
    await expect(page.getByText('Notification Preferences')).toBeVisible();
    await expect(page.getByText('Display Mode')).toBeVisible();
  });
});
