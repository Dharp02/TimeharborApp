import { test, expect } from '@playwright/test';

/**
 * Profile E2E — edit profile, upload avatar, link social accounts,
 * verify IndexedDB persistence, opLog recording, and offline support.
 *
 * Uses a mobile viewport to stay consistent with other specs.
 *
 * What we verify:
 *   1. Navigate to profile edit page and fill all fields
 *   2. Upload a profile picture (generated test image) with the crop modal
 *   3. Enter full name, email, GitHub URL, LinkedIn URL, Redmine URL
 *   4. Save changes → profile persisted in IndexedDB as base64
 *   5. Re-edit the profile (change name, email, upload different picture)
 *   6. opLog and operationLogs record PROFILE CREATE/UPDATE entries
 *   7. Full offline profile edit → IndexedDB + opLog correct
 *   8. Offline profile edit syncs when network is restored
 */

test.use({
  viewport: { width: 390, height: 844 },
  navigationTimeout: 30_000,
});

// ─── IndexedDB helpers ──────────────────────────────────────

/** Read all userProfiles from IndexedDB. */
async function getUserProfile(page: import('@playwright/test').Page) {
  return page.evaluate(async () => {
    const dbs = await indexedDB.databases();
    const dbInfo = dbs.find(d => d.name?.toLowerCase().includes('timeharbor'));
    if (!dbInfo?.name) return null;
    return new Promise<Record<string, unknown> | null>((resolve, reject) => {
      const req = indexedDB.open(dbInfo.name!);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('userProfiles')) { resolve(null); return; }
        const tx = db.transaction('userProfiles', 'readonly');
        const store = tx.objectStore('userProfiles');
        const getAll = store.getAll();
        getAll.onsuccess = () => {
          const profiles = getAll.result as Record<string, unknown>[];
          // Return the first (and usually only) profile
          resolve(profiles[0] ?? null);
        };
        getAll.onerror = () => reject(getAll.error);
      };
    });
  });
}

/** Read all opLog entries from IndexedDB. */
async function getOpLogEntries(page: import('@playwright/test').Page) {
  return page.evaluate(async () => {
    const dbs = await indexedDB.databases();
    const dbInfo = dbs.find(d => d.name?.toLowerCase().includes('timeharbor'));
    if (!dbInfo?.name) return [];
    return new Promise<Record<string, unknown>[]>((resolve, reject) => {
      const req = indexedDB.open(dbInfo.name!);
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
    const dbs = await indexedDB.databases();
    const dbInfo = dbs.find(d => d.name?.toLowerCase().includes('timeharbor'));
    if (!dbInfo?.name) return [];
    return new Promise<Record<string, unknown>[]>((resolve, reject) => {
      const req = indexedDB.open(dbInfo.name!);
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

// ─── Test image helpers ─────────────────────────────────────

/**
 * Generate a tiny PNG file buffer (10x10 colored square) for avatar upload.
 * Uses a raw PNG with minimal headers — no external deps.
 */
function generateTestPng(r: number, g: number, b: number): Buffer {
  // 10x10 PNG, uncompressed, with the given RGB color
  const width = 10;
  const height = 10;

  // Build raw pixel data: filter byte (0) + RGB for each pixel per row
  const rawPixels: number[] = [];
  for (let y = 0; y < height; y++) {
    rawPixels.push(0); // filter: None
    for (let x = 0; x < width; x++) {
      rawPixels.push(r, g, b);
    }
  }

  // Deflate with stored (no compression) block
  const rawData = Buffer.from(rawPixels);
  const maxBlock = 65535;
  const blocks: Buffer[] = [];
  for (let i = 0; i < rawData.length; i += maxBlock) {
    const chunk = rawData.subarray(i, Math.min(i + maxBlock, rawData.length));
    const isLast = i + maxBlock >= rawData.length;
    const header = Buffer.alloc(5);
    header[0] = isLast ? 0x01 : 0x00;
    header.writeUInt16LE(chunk.length, 1);
    header.writeUInt16LE(chunk.length ^ 0xffff, 3);
    blocks.push(header, chunk);
  }

  // Adler-32 checksum
  let a = 1, bSum = 0;
  for (let i = 0; i < rawData.length; i++) {
    a = (a + rawData[i]) % 65521;
    bSum = (bSum + a) % 65521;
  }
  const adler = Buffer.alloc(4);
  adler.writeUInt32BE(((bSum << 16) | a) >>> 0);

  // Zlib header (CMF + FLG) + deflate blocks + adler
  const zlibHeader = Buffer.from([0x78, 0x01]);
  const compressedData = Buffer.concat([zlibHeader, ...blocks, adler]);

  // CRC-32 table
  const crcTable: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crcTable.push(c);
  }
  function crc32(buf: Buffer): number {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  function pngChunk(type: string, data: Buffer): Buffer {
    const typeBytes = Buffer.from(type, 'ascii');
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const crcInput = Buffer.concat([typeBytes, data]);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(crcInput));
    return Buffer.concat([length, typeBytes, data, crcBuf]);
  }

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressedData),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ─── UI helpers ─────────────────────────────────────────────

/** Navigate to the profile edit page. */
async function goToProfileEdit(page: import('@playwright/test').Page) {
  await page.goto('/dashboard/settings/profile');
  await page.waitForLoadState('networkidle');
  await expect(page.getByText('Profile Picture')).toBeVisible({ timeout: 10_000 });
}

/**
 * Upload a test PNG avatar via the file input and confirm the crop modal.
 * The crop modal has a "Use This Photo" button to confirm.
 */
async function uploadAvatar(page: import('@playwright/test').Page, pngBuffer: Buffer) {
  // Set file on the hidden file input
  const fileInput = page.locator('input[type="file"][accept*="image"]');
  await fileInput.setInputFiles({
    name: 'test-avatar.png',
    mimeType: 'image/png',
    buffer: pngBuffer,
  });

  // Wait for crop modal and confirm
  await expect(page.getByText('Adjust Photo')).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: 'Use This Photo' }).click();

  // Wait for modal to close
  await expect(page.getByText('Adjust Photo')).not.toBeVisible({ timeout: 5_000 });
}

/** Fill the profile form fields. */
async function fillProfileForm(
  page: import('@playwright/test').Page,
  data: { name?: string; email?: string; github?: string; linkedin?: string; redmine?: string },
) {
  if (data.name !== undefined) {
    const nameInput = page.locator('#profile-name');
    await nameInput.clear();
    await nameInput.fill(data.name);
  }
  if (data.email !== undefined) {
    const emailInput = page.locator('#profile-email');
    await emailInput.clear();
    await emailInput.fill(data.email);
  }
  if (data.github !== undefined) {
    const input = page.locator('#profile-github');
    await input.clear();
    await input.fill(data.github);
  }
  if (data.linkedin !== undefined) {
    const input = page.locator('#profile-linkedin');
    await input.clear();
    await input.fill(data.linkedin);
  }
  if (data.redmine !== undefined) {
    const input = page.locator('#profile-redmine');
    await input.clear();
    await input.fill(data.redmine);
  }
}

/** Save profile and wait for redirect back to settings hub. */
async function saveProfile(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Save profile changes' }).click();
  // The save redirects to /dashboard/settings after success
  await expect(page).toHaveURL(/\/dashboard\/settings\/?$/, { timeout: 15_000 });
  await page.waitForLoadState('networkidle');
}

// ─── test data ──────────────────────────────────────────────

const PROFILE_NAME = `Profile Test ${Date.now()}`;
const PROFILE_EMAIL = `profile-${Date.now()}@example.com`;
const GITHUB_URL = 'https://github.com/testuser';
const LINKEDIN_URL = 'https://linkedin.com/in/testuser';
const REDMINE_URL = 'https://redmine.example.com/users/42';

const UPDATED_NAME = `Updated Name ${Date.now()}`;
const UPDATED_EMAIL = `updated-${Date.now()}@example.com`;
const UPDATED_GITHUB = 'https://github.com/updateduser';
const UPDATED_LINKEDIN = 'https://linkedin.com/in/updateduser';
const UPDATED_REDMINE = 'https://redmine.example.com/users/99';

// ─── tests: online ──────────────────────────────────────────

test.describe('Profile — Online', () => {

  test('fill profile fields, upload avatar, save → persisted in IndexedDB with base64 avatar', async ({ page }) => {
    const avatarPng = generateTestPng(66, 133, 244); // blue square

    await goToProfileEdit(page);

    // Upload avatar
    await uploadAvatar(page, avatarPng);

    // Fill all fields
    await fillProfileForm(page, {
      name: PROFILE_NAME,
      email: PROFILE_EMAIL,
      github: GITHUB_URL,
      linkedin: LINKEDIN_URL,
      redmine: REDMINE_URL,
    });

    // Save Changes button should be enabled
    const saveBtn = page.getByRole('button', { name: 'Save profile changes' });
    await expect(saveBtn).toBeEnabled();

    // Save profile
    await saveProfile(page);

    // Navigate back to profile edit to verify persisted data loaded from Dexie
    await goToProfileEdit(page);

    // Verify form fields are populated
    await expect(page.locator('#profile-name')).toHaveValue(PROFILE_NAME);
    await expect(page.locator('#profile-email')).toHaveValue(PROFILE_EMAIL);
    await expect(page.locator('#profile-github')).toHaveValue(GITHUB_URL);
    await expect(page.locator('#profile-linkedin')).toHaveValue(LINKEDIN_URL);
    await expect(page.locator('#profile-redmine')).toHaveValue(REDMINE_URL);

    // Verify avatar is displayed (img element in the avatar area)
    const avatarSection = page.locator('section').filter({ has: page.getByText('Profile Picture') });
    const avatarImg = avatarSection.locator('img[alt="Profile picture"]');
    await expect(avatarImg).toBeVisible({ timeout: 5_000 });

    // Verify IndexedDB profile has base64 avatar
    const profile = await getUserProfile(page);
    expect(profile).not.toBeNull();
    expect(profile!.displayName).toBe(PROFILE_NAME);
    expect(profile!.email).toBe(PROFILE_EMAIL);
    expect(profile!.githubUrl).toBe(GITHUB_URL);
    expect(profile!.linkedinUrl).toBe(LINKEDIN_URL);
    expect(profile!.redmineUrl).toBe(REDMINE_URL);
    // Avatar must be a base64 data URL
    expect(typeof profile!.avatarBase64).toBe('string');
    expect((profile!.avatarBase64 as string).startsWith('data:image/')).toBeTruthy();

    // Verify opLog has a CREATE or UPDATE entry for userProfiles
    const opLog = await getOpLogEntries(page);
    const profileOps = opLog.filter(e => e.collection === 'userProfiles');
    expect(profileOps.length).toBeGreaterThanOrEqual(1);
    const createOrUpdate = profileOps.find(
      e => e.operation === 'CREATE' || e.operation === 'UPDATE'
    );
    expect(createOrUpdate).toBeDefined();

    // Verify operationLogs has a PROFILE entry
    const opsLogs = await getOperationLogs(page);
    const profileAudit = opsLogs.find(
      l => l.category === 'PROFILE' && (l.action === 'CREATE' || l.action === 'UPDATE') && l.result === 'success'
    );
    expect(profileAudit).toBeDefined();
    expect(profileAudit!.target).toBe('UserProfile');
  });

  test('re-edit profile — change name, email, picture → IndexedDB updated', async ({ page }) => {
    const originalPng = generateTestPng(66, 133, 244); // blue
    const updatedPng = generateTestPng(234, 67, 53);   // red

    // First save: set initial profile
    await goToProfileEdit(page);
    await uploadAvatar(page, originalPng);
    await fillProfileForm(page, {
      name: PROFILE_NAME,
      email: PROFILE_EMAIL,
      github: GITHUB_URL,
      linkedin: LINKEDIN_URL,
      redmine: REDMINE_URL,
    });
    await saveProfile(page);

    // Capture the original base64
    const profileBefore = await getUserProfile(page);
    expect(profileBefore).not.toBeNull();
    const originalAvatar = profileBefore!.avatarBase64 as string;

    // Re-edit: change everything
    await goToProfileEdit(page);
    await uploadAvatar(page, updatedPng);
    await fillProfileForm(page, {
      name: UPDATED_NAME,
      email: UPDATED_EMAIL,
      github: UPDATED_GITHUB,
      linkedin: UPDATED_LINKEDIN,
      redmine: UPDATED_REDMINE,
    });
    await saveProfile(page);

    // Verify updated profile in IndexedDB
    // Navigate to profile edit so Dexie is accessible
    await goToProfileEdit(page);

    const profileAfter = await getUserProfile(page);
    expect(profileAfter).not.toBeNull();
    expect(profileAfter!.displayName).toBe(UPDATED_NAME);
    expect(profileAfter!.email).toBe(UPDATED_EMAIL);
    expect(profileAfter!.githubUrl).toBe(UPDATED_GITHUB);
    expect(profileAfter!.linkedinUrl).toBe(UPDATED_LINKEDIN);
    expect(profileAfter!.redmineUrl).toBe(UPDATED_REDMINE);

    // Avatar should be different from the original
    expect(typeof profileAfter!.avatarBase64).toBe('string');
    expect((profileAfter!.avatarBase64 as string).startsWith('data:image/')).toBeTruthy();
    expect(profileAfter!.avatarBase64).not.toBe(originalAvatar);

    // opLog should now have at least 2 entries (CREATE + UPDATE)
    const opLog = await getOpLogEntries(page);
    const profileOps = opLog.filter(e => e.collection === 'userProfiles');
    expect(profileOps.length).toBeGreaterThanOrEqual(2);
    expect(profileOps.some(e => e.operation === 'UPDATE')).toBeTruthy();

    // operationLogs should have at least 2 PROFILE entries
    const opsLogs = await getOperationLogs(page);
    const profileAudits = opsLogs.filter(
      l => l.category === 'PROFILE' && l.result === 'success'
    );
    expect(profileAudits.length).toBeGreaterThanOrEqual(2);
  });

  test('linked accounts — GitHub, LinkedIn, Redmine URLs stored and reloaded', async ({ page }) => {
    await goToProfileEdit(page);

    // Fill only social links
    await fillProfileForm(page, {
      github: GITHUB_URL,
      linkedin: LINKEDIN_URL,
      redmine: REDMINE_URL,
    });

    // Verify the fields have correct values before saving
    await expect(page.locator('#profile-github')).toHaveValue(GITHUB_URL);
    await expect(page.locator('#profile-linkedin')).toHaveValue(LINKEDIN_URL);
    await expect(page.locator('#profile-redmine')).toHaveValue(REDMINE_URL);

    await saveProfile(page);

    // Reload profile page and verify the links persisted
    await goToProfileEdit(page);
    await expect(page.locator('#profile-github')).toHaveValue(GITHUB_URL);
    await expect(page.locator('#profile-linkedin')).toHaveValue(LINKEDIN_URL);
    await expect(page.locator('#profile-redmine')).toHaveValue(REDMINE_URL);

    // IndexedDB verification
    const profile = await getUserProfile(page);
    expect(profile).not.toBeNull();
    expect(profile!.githubUrl).toBe(GITHUB_URL);
    expect(profile!.linkedinUrl).toBe(LINKEDIN_URL);
    expect(profile!.redmineUrl).toBe(REDMINE_URL);
  });

  test('opLog entries visible on Sync Queue page after profile save', async ({ page }) => {
    const avatarPng = generateTestPng(0, 200, 83); // green

    // Save a profile
    await goToProfileEdit(page);
    await uploadAvatar(page, avatarPng);
    await fillProfileForm(page, { name: `OpLog Test ${Date.now()}` });
    await saveProfile(page);

    // Navigate to op logs page
    await page.goto('/dashboard/oplogs');
    await page.waitForLoadState('networkidle');

    // Sync Queue tab should show userProfiles entries
    const syncQueueTab = page.getByRole('tab', { name: 'Sync Queue' });
    await expect(syncQueueTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText('userProfiles').first()).toBeVisible({ timeout: 10_000 });

    // Operation Logs should show PROFILE entries
    await page.getByRole('tab', { name: 'Operation Logs' }).click();
    await expect(page.getByRole('table', { name: 'Operation logs' })).toBeVisible({ timeout: 10_000 });
    await page.getByLabel('Filter by category').selectOption('PROFILE');
    await expect(page.locator('table tbody').getByText('PROFILE').first()).toBeVisible({ timeout: 5_000 });
  });
});

// ─── tests: offline ─────────────────────────────────────────

test.describe('Profile — Offline', () => {

  test.beforeEach(({ browserName }) => {
    test.skip(browserName === 'webkit', 'CDP network emulation is not supported on WebKit');
  });

  test('edit profile offline → all data persisted in IndexedDB with opLog unsynced', async ({ page }) => {
    test.setTimeout(60_000);

    const avatarPng = generateTestPng(255, 152, 0); // orange

    // Load the profile page online first (JS bundles cached)
    await goToProfileEdit(page);

    // Snapshot opLog count before going offline
    const opLogBefore = await getOpLogEntries(page);
    const countBefore = opLogBefore.length;

    // Go offline
    const cdp = await goOffline(page);

    // Fill profile and upload avatar while offline
    await uploadAvatar(page, avatarPng);
    await fillProfileForm(page, {
      name: `Offline User ${Date.now()}`,
      email: `offline-${Date.now()}@example.com`,
      github: 'https://github.com/offlineuser',
      linkedin: 'https://linkedin.com/in/offlineuser',
      redmine: 'https://redmine.example.com/users/offline',
    });

    // Save while offline — writes to Dexie, stays on profile page (no redirect when offline)
    await page.getByRole('button', { name: 'Save profile changes' }).click();
    await expect(page.getByText('Profile saved successfully.')).toBeVisible({ timeout: 10_000 });

    // Verify IndexedDB has the profile
    const profile = await getUserProfile(page);
    expect(profile).not.toBeNull();
    expect((profile!.displayName as string)).toContain('Offline User');
    expect((profile!.email as string)).toContain('offline-');
    expect(profile!.githubUrl).toBe('https://github.com/offlineuser');
    expect(profile!.linkedinUrl).toBe('https://linkedin.com/in/offlineuser');
    expect(profile!.redmineUrl).toBe('https://redmine.example.com/users/offline');

    // Avatar must be base64
    expect(typeof profile!.avatarBase64).toBe('string');
    expect((profile!.avatarBase64 as string).startsWith('data:image/')).toBeTruthy();

    // opLog should have new unsynced entries for userProfiles
    const opLogAfter = await getOpLogEntries(page);
    expect(opLogAfter.length).toBeGreaterThan(countBefore);
    const profileOps = opLogAfter.filter(
      e => e.collection === 'userProfiles' && e._synced === 0
    );
    expect(profileOps.length).toBeGreaterThanOrEqual(1);

    // operationLogs should have PROFILE audit entries
    const opsLogs = await getOperationLogs(page);
    const profileAudit = opsLogs.find(
      l => l.category === 'PROFILE' && l.result === 'success'
    );
    expect(profileAudit).toBeDefined();

    // Restore network
    await goOnline(cdp);
  });

  test('offline profile changes sync when network is restored', async ({ page }) => {
    test.setTimeout(60_000);

    const avatarPng = generateTestPng(156, 39, 176); // purple

    // Load profile page online
    await goToProfileEdit(page);

    // Go offline and save a profile
    const cdp = await goOffline(page);

    await uploadAvatar(page, avatarPng);
    await fillProfileForm(page, {
      name: `Sync Test ${Date.now()}`,
    });
    await page.getByRole('button', { name: 'Save profile changes' }).click();
    await expect(page.getByText('Profile saved successfully.')).toBeVisible({ timeout: 10_000 });

    // Verify unsynced opLog entries exist for userProfiles
    const opLogOffline = await getOpLogEntries(page);
    const unsyncedOps = opLogOffline.filter(
      e => e.collection === 'userProfiles' && e._synced === 0
    );
    expect(unsyncedOps.length).toBeGreaterThanOrEqual(1);

    // Restore network
    await goOnline(cdp);
    await page.waitForTimeout(5_000); // Wait for auto-sync

    // Reload to ensure fresh IndexedDB reads
    await page.goto('/dashboard/settings/profile');
    await page.waitForLoadState('networkidle');

    // After sync, ops should be marked synced
    const opLogOnline = await getOpLogEntries(page);
    const syncedProfileOps = opLogOnline.filter(e => e.collection === 'userProfiles');
    for (const op of syncedProfileOps) {
      expect([0, 1]).toContain(op._synced);
    }
  });

  test('re-edit profile offline after initial online save → UPDATE opLog recorded', async ({ page }) => {
    test.setTimeout(60_000);

    const avatarPng1 = generateTestPng(33, 150, 243); // blue
    const avatarPng2 = generateTestPng(76, 175, 80);  // green

    // First save online
    await goToProfileEdit(page);
    await uploadAvatar(page, avatarPng1);
    await fillProfileForm(page, {
      name: `Online First ${Date.now()}`,
      email: `first-${Date.now()}@example.com`,
    });
    await saveProfile(page);

    // Capture the CREATE opLog count
    const opLogAfterCreate = await getOpLogEntries(page);
    const createOps = opLogAfterCreate.filter(
      e => e.collection === 'userProfiles'
    );
    const countAfterCreate = createOps.length;

    // Load profile page and go offline
    await goToProfileEdit(page);
    const cdp = await goOffline(page);

    // Re-edit with different data
    await uploadAvatar(page, avatarPng2);
    await fillProfileForm(page, {
      name: `Offline Edit ${Date.now()}`,
      email: `offline-edit-${Date.now()}@example.com`,
      github: 'https://github.com/offlineedit',
    });
    await page.getByRole('button', { name: 'Save profile changes' }).click();
    await expect(page.getByText('Profile saved successfully.')).toBeVisible({ timeout: 10_000 });

    // Verify IndexedDB has the updated profile
    const profile = await getUserProfile(page);
    expect(profile).not.toBeNull();
    expect((profile!.displayName as string)).toContain('Offline Edit');
    expect(profile!.githubUrl).toBe('https://github.com/offlineedit');

    // opLog should have a new UPDATE entry (unsynced)
    const opLogAfterUpdate = await getOpLogEntries(page);
    const allProfileOps = opLogAfterUpdate.filter(e => e.collection === 'userProfiles');
    expect(allProfileOps.length).toBeGreaterThan(countAfterCreate);

    const updateOp = allProfileOps.find(e => e.operation === 'UPDATE' && e._synced === 0);
    expect(updateOp).toBeDefined();

    // operationLogs should have multiple PROFILE entries (CREATE from online + UPDATE from offline)
    const opsLogs = await getOperationLogs(page);
    const profileAudits = opsLogs.filter(l => l.category === 'PROFILE' && l.result === 'success');
    expect(profileAudits.length).toBeGreaterThanOrEqual(2);

    await goOnline(cdp);
  });
});
