import { test, expect } from '@playwright/test';

/**
 * Offline-first Tickets E2E — verify IndexedDB-only CRUD, opLog recording,
 * and the Operations Logs dashboard page.
 *
 * These tests run entirely offline (network disabled after initial page load)
 * to confirm the app works without a backend. Then we verify the opLog entries
 * that would be synced when connectivity returns.
 *
 * We also test the /dashboard/oplogs page for visibility of sync queue and
 * operation logs.
 */

test.use({
  viewport: { width: 390, height: 844 },
  navigationTimeout: 30_000,
});

// ─── IndexedDB helpers ──────────────────────────────────────

/** Read all non-deleted tickets from IndexedDB. */
async function getTickets(page: import('@playwright/test').Page) {
  return page.evaluate(async () => {
    const uuid = localStorage.getItem('th_identity_uuid');
    const dbName = uuid ? `TimeharborDB_${uuid}` : 'TimeharborDB';
    return new Promise<Record<string, unknown>[]>((resolve, reject) => {
      const req = indexedDB.open(dbName);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('tickets')) { resolve([]); return; }
        const tx = db.transaction('tickets', 'readonly');
        const store = tx.objectStore('tickets');
        const getAll = store.getAll();
        getAll.onsuccess = () => {
          resolve((getAll.result as Record<string, unknown>[]).filter(t => !t._deleted));
        };
        getAll.onerror = () => reject(getAll.error);
      };
    });
  });
}

/** Read a ticket by id (including soft-deleted). */
async function getTicketById(page: import('@playwright/test').Page, ticketId: string) {
  return page.evaluate(async (id) => {
    const uuid = localStorage.getItem('th_identity_uuid');
    const dbName = uuid ? `TimeharborDB_${uuid}` : 'TimeharborDB';
    return new Promise<Record<string, unknown> | null>((resolve, reject) => {
      const req = indexedDB.open(dbName);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('tickets', 'readonly');
        const store = tx.objectStore('tickets');
        const get = store.get(id);
        get.onsuccess = () => resolve((get.result as Record<string, unknown>) ?? null);
        get.onerror = () => reject(get.error);
      };
    });
  }, ticketId);
}

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

// ─── Offline helper ─────────────────────────────────────────

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

// ─── tests ──────────────────────────────────────────────────

test.describe('Offline Tickets — IndexedDB-only CRUD & OpLog', () => {

  test.beforeEach(({ browserName }) => {
    test.skip(browserName === 'webkit', 'CDP network emulation is not supported on WebKit');
  });

  test('create ticket offline → stored in IndexedDB with unsynced opLog entry', async ({ page }) => {
    // Navigate to create page online so JS bundles are loaded
    await page.goto('/dashboard/tickets/create');
    await page.waitForLoadState('networkidle');

    // Go offline
    const cdp = await goOffline(page);

    // Snapshot opLog count before
    const opLogBefore = await getOpLogEntries(page);
    const countBefore = opLogBefore.length;

    // Create a ticket while offline (page already loaded)
    const title = `Offline Create ${Date.now()}`;
    await page.getByPlaceholder('Enter ticket title').fill(title);
    await page.getByRole('button', { name: 'Create Ticket' }).click();

    // After submit the app tries to navigate back; it may or may not succeed
    // offline. Wait a moment for IndexedDB writes to complete.
    await page.waitForTimeout(2_000);

    // Restore network — the page may have landed on chrome-error; we need to
    // navigate back to the app to read IndexedDB.
    await goOnline(cdp);
    await page.goto('/dashboard/tickets');
    await page.waitForLoadState('networkidle');

    // Verify the ticket is in IndexedDB
    const tickets = await getTickets(page);
    const created = tickets.find(t => t.title === title);
    expect(created).toBeDefined();
    expect(created!.status).toBe('Open');

    // Verify opLog has a CREATE entry for this ticket, marked unsynced
    const opLogAfter = await getOpLogEntries(page);
    expect(opLogAfter.length).toBeGreaterThan(countBefore);

    const createOp = opLogAfter.find(
      e => e.collection === 'tickets' && e.operation === 'CREATE' && e.entityId === created!.id
    );
    expect(createOp).toBeDefined();
    // The entry was created offline; after going online the auto-sync may have
    // already pushed it, so _synced can be 0 (unsynced) or 1 (just synced).
    expect([0, 1]).toContain(createOp!._synced);
    expect(createOp!._syncEnabled).toBe(1);
    expect(createOp!.snapshot).toBeDefined();

    // Verify operationLogs audit entry
    const opsLogs = await getOperationLogs(page);
    const auditEntry = opsLogs.find(
      l => l.category === 'TICKET' && l.action === 'CREATE' && l.targetId === created!.id
    );
    expect(auditEntry).toBeDefined();
    expect(auditEntry!.result).toBe('success');
  });

  test('edit ticket offline → IndexedDB and opLog updated with patch', async ({ page }) => {
    // Create a ticket online first
    await page.goto('/dashboard/tickets/create');
    await page.waitForLoadState('networkidle');
    const title = `Offline Edit ${Date.now()}`;
    await page.getByPlaceholder('Enter ticket title').fill(title);
    await page.getByRole('button', { name: 'Create Ticket' }).click();
    await expect(page).toHaveURL(/\/dashboard\/tickets\/?$/, { timeout: 10_000 });
    await page.waitForLoadState('networkidle');

    // Get the ticket id
    const tickets = await getTickets(page);
    const ticket = tickets.find(t => t.title === title);
    expect(ticket).toBeDefined();
    const ticketId = ticket!.id as string;

    // Navigate to edit page online (so route bundles are loaded)
    await page.getByLabel('Ticket actions').click();
    await page.getByText('Edit Ticket').click();
    await expect(page).toHaveURL(/\/dashboard\/tickets\/edit/, { timeout: 10_000 });
    await page.waitForLoadState('networkidle');

    // Now go offline for the actual edit
    const cdp = await goOffline(page);

    // Update the title
    const editedTitle = `${title} — offline edit`;
    const titleInput = page.getByPlaceholder('Ticket title');
    await titleInput.clear();
    await titleInput.fill(editedTitle);
    await page.getByRole('button', { name: 'Update' }).click();

    // After submit the app tries to navigate back; wait for IndexedDB writes.
    await page.waitForTimeout(2_000);

    // Restore network — the page may have landed on chrome-error; navigate
    // back to the app to read IndexedDB.
    await goOnline(cdp);
    await page.goto('/dashboard/tickets');
    await page.waitForLoadState('networkidle');

    // Verify IndexedDB has updated title
    const updated = await getTicketById(page, ticketId);
    expect(updated).not.toBeNull();
    expect(updated!.title).toBe(editedTitle);

    // Verify opLog has an UPDATE entry with the patch
    const opLog = await getOpLogEntries(page);
    const updateOp = opLog.find(
      e => e.collection === 'tickets' && e.operation === 'UPDATE' && e.entityId === ticketId
    );
    expect(updateOp).toBeDefined();
    // After restoring network, auto-sync may have already pushed this.
    expect([0, 1]).toContain(updateOp!._synced);
    expect(updateOp!.patch).toBeDefined();
  });

  test('delete ticket offline → soft-deleted in IndexedDB with DELETE opLog entry', async ({ page }) => {
    // Create a ticket online first
    await page.goto('/dashboard/tickets/create');
    await page.waitForLoadState('networkidle');
    const title = `Offline Delete ${Date.now()}`;
    await page.getByPlaceholder('Enter ticket title').fill(title);
    await page.getByRole('button', { name: 'Create Ticket' }).click();
    await expect(page).toHaveURL(/\/dashboard\/tickets\/?$/, { timeout: 10_000 });
    await page.waitForLoadState('networkidle');

    const tickets = await getTickets(page);
    const ticket = tickets.find(t => t.title === title);
    expect(ticket).toBeDefined();
    const ticketId = ticket!.id as string;

    // Go offline
    const cdp = await goOffline(page);

    // Delete via actions dropdown
    await page.getByLabel('Ticket actions').click();
    await page.getByText('Delete Ticket').first().click();
    await expect(page.getByText('Are you sure you want to delete')).toBeVisible({ timeout: 5_000 });
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await page.waitForTimeout(1_000);

    // Ticket should be gone from active list
    await expect(page.getByText(title)).not.toBeVisible({ timeout: 5_000 });

    // IndexedDB: ticket should be soft-deleted
    const deleted = await getTicketById(page, ticketId);
    if (deleted) {
      expect(deleted._deleted).toBe(true);
    }

    // opLog should have a DELETE entry
    const opLog = await getOpLogEntries(page);
    const deleteOp = opLog.find(
      e => e.collection === 'tickets' && e.operation === 'DELETE' && e.entityId === ticketId
    );
    expect(deleteOp).toBeDefined();
    expect(deleteOp!._synced).toBe(0);

    // operationLogs audit entry
    const opsLogs = await getOperationLogs(page);
    const auditEntry = opsLogs.find(
      l => l.category === 'TICKET' && l.action === 'DELETE' && l.targetId === ticketId
    );
    expect(auditEntry).toBeDefined();
    expect(auditEntry!.result).toBe('success');

    await goOnline(cdp);
  });

  test('change status offline → IndexedDB updated with opLog UPDATE entry', async ({ page }) => {
    // Create ticket online
    await page.goto('/dashboard/tickets/create');
    await page.waitForLoadState('networkidle');
    const title = `Offline Status ${Date.now()}`;
    await page.getByPlaceholder('Enter ticket title').fill(title);
    await page.getByRole('button', { name: 'Create Ticket' }).click();
    await expect(page).toHaveURL(/\/dashboard\/tickets\/?$/, { timeout: 10_000 });
    await page.waitForLoadState('networkidle');

    const tickets = await getTickets(page);
    const ticket = tickets.find(t => t.title === title);
    expect(ticket).toBeDefined();
    const ticketId = ticket!.id as string;

    // Go offline
    const cdp = await goOffline(page);

    // Change status via dropdown
    await page.getByLabel('Ticket actions').click();
    await page.getByText('Change Status').first().click();
    await expect(page.getByText('Select a new status for')).toBeVisible({ timeout: 5_000 });
    await page.getByRole('button', { name: 'In Progress' }).click();
    await page.waitForTimeout(1_000);

    // Verify IndexedDB
    const updated = await getTicketById(page, ticketId);
    expect(updated).not.toBeNull();
    expect(updated!.status).toBe('In Progress');

    // opLog should have UPDATE entry
    const opLog = await getOpLogEntries(page);
    const statusOp = opLog.find(
      e => e.collection === 'tickets' && e.operation === 'UPDATE' && e.entityId === ticketId
    );
    expect(statusOp).toBeDefined();
    expect(statusOp!._synced).toBe(0);

    await goOnline(cdp);
  });

  test('multiple offline operations → all queued in opLog as unsynced', async ({ page }) => {
    // Create a ticket online first so we have something to act on
    await page.goto('/dashboard/tickets/create');
    await page.waitForLoadState('networkidle');
    const title = `Batch Offline ${Date.now()}`;
    await page.getByPlaceholder('Enter ticket title').fill(title);
    await page.getByRole('button', { name: 'Create Ticket' }).click();
    await expect(page).toHaveURL(/\/dashboard\/tickets\/?$/, { timeout: 10_000 });
    await page.waitForLoadState('networkidle');

    const tickets = await getTickets(page);
    const ticket = tickets.find(t => t.title === title);
    expect(ticket).toBeDefined();
    const ticketId = ticket!.id as string;

    // Go offline — perform multiple operations on the same page
    const cdp = await goOffline(page);
    const opLogBefore = await getOpLogEntries(page);
    const countBefore = opLogBefore.filter(e => e.collection === 'tickets' && e._synced === 0).length;

    // Operation 1: Change status to In Progress
    await page.getByLabel('Ticket actions').click();
    await page.getByText('Change Status').first().click();
    await expect(page.getByText('Select a new status for')).toBeVisible({ timeout: 5_000 });
    await page.getByRole('button', { name: 'In Progress' }).click();
    await page.waitForTimeout(1_000);

    // Operation 2: Delete the ticket
    await page.getByLabel('Ticket actions').click();
    await page.getByText('Delete Ticket').first().click();
    await expect(page.getByText('Are you sure you want to delete')).toBeVisible({ timeout: 5_000 });
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await page.waitForTimeout(1_000);

    // OpLog should have 2+ new unsynced entries (UPDATE + DELETE)
    const opLogAfter = await getOpLogEntries(page);
    const newUnsyncedOps = opLogAfter.filter(
      e => e.collection === 'tickets' && e._synced === 0 && e.entityId === ticketId
    );
    // At least UPDATE (status change) + DELETE
    expect(newUnsyncedOps.length).toBeGreaterThanOrEqual(2);
    expect(newUnsyncedOps.some(e => e.operation === 'UPDATE')).toBeTruthy();
    expect(newUnsyncedOps.some(e => e.operation === 'DELETE')).toBeTruthy();

    await goOnline(cdp);
  });
});

test.describe('Operations Logs Page — /dashboard/oplogs', () => {

  test('Sync Queue tab shows opLog entries after ticket creation', async ({ page }) => {
    // Create a ticket so there is at least one opLog entry
    await page.goto('/dashboard/tickets/create');
    await page.waitForLoadState('networkidle');
    const title = `OpLog UI ${Date.now()}`;
    await page.getByPlaceholder('Enter ticket title').fill(title);
    await page.getByRole('button', { name: 'Create Ticket' }).click();
    await expect(page).toHaveURL(/\/dashboard\/tickets\/?$/, { timeout: 10_000 });
    await page.waitForLoadState('networkidle');

    // Navigate to oplogs page
    await page.goto('/dashboard/oplogs');
    await page.waitForLoadState('networkidle');

    // "Sync Queue" tab should be active by default
    const syncQueueTab = page.getByRole('tab', { name: 'Sync Queue' });
    await expect(syncQueueTab).toHaveAttribute('aria-selected', 'true');

    // Should see at least one opLog card with "CREATE" and "tickets"
    await expect(page.getByText('CREATE').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('tickets').first()).toBeVisible();
  });

  test('Operation Logs tab shows ticket audit trail', async ({ page }) => {
    // Create a ticket for an audit entry
    await page.goto('/dashboard/tickets/create');
    await page.waitForLoadState('networkidle');
    const title = `Audit Trail ${Date.now()}`;
    await page.getByPlaceholder('Enter ticket title').fill(title);
    await page.getByRole('button', { name: 'Create Ticket' }).click();
    await expect(page).toHaveURL(/\/dashboard\/tickets\/?$/, { timeout: 10_000 });
    await page.waitForLoadState('networkidle');

    // Navigate to oplogs page
    await page.goto('/dashboard/oplogs');
    await page.waitForLoadState('networkidle');

    // Switch to Operation Logs tab
    await page.getByRole('tab', { name: 'Operation Logs' }).click();

    // Should show the operation logs table
    await expect(page.getByRole('table', { name: 'Operation logs' })).toBeVisible({ timeout: 10_000 });

    // Should have a TICKET/CREATE entry
    await expect(page.getByText('TICKET').first()).toBeVisible();
    await expect(page.getByText('CREATE').first()).toBeVisible();

    // Filter by TICKET category
    await page.getByLabel('Filter by category').selectOption('TICKET');
    // All visible entries should be TICKET
    await expect(page.getByText('TICKET').first()).toBeVisible();
  });

  test('Operation Logs tab can filter by result', async ({ page }) => {
    // Create a ticket first to generate operation logs
    await page.goto('/dashboard/tickets/create');
    await page.waitForLoadState('networkidle');
    await page.getByPlaceholder('Enter ticket title').fill(`Filter Test ${Date.now()}`);
    await page.getByRole('button', { name: 'Create Ticket' }).click();
    await expect(page).toHaveURL(/\/dashboard\/tickets\/?$/, { timeout: 10_000 });
    await page.waitForLoadState('networkidle');

    // Navigate to oplogs page
    await page.goto('/dashboard/oplogs');
    await page.waitForLoadState('networkidle');

    // Switch to Operation Logs tab
    await page.getByRole('tab', { name: 'Operation Logs' }).click();
    await expect(page.getByRole('table', { name: 'Operation logs' })).toBeVisible({ timeout: 10_000 });

    // Filter by success
    await page.getByLabel('Filter by result').selectOption('success');
    await expect(page.getByText('OK').first()).toBeVisible({ timeout: 5_000 });
  });

  test('Diagnostics tab runs checks', async ({ page }) => {
    await page.goto('/dashboard/oplogs');
    await page.waitForLoadState('networkidle');

    // Unlock hidden Diagnostics tab by clicking the page title 5 times
    const pageTitle = page.getByLabel('Sync and Logs');
    for (let i = 0; i < 5; i++) {
      await pageTitle.click();
    }

    // Switch to Diagnostics tab
    await page.getByRole('tab', { name: 'Diagnostics' }).click();

    // Should show "Run Diagnostics" button
    const runButton = page.getByRole('button', { name: 'Run Diagnostics' });
    await expect(runButton).toBeVisible({ timeout: 10_000 });

    // Run diagnostics
    await runButton.click();

    // Wait for at least one result to show pass/fail status
    await expect(
      page.locator('text=PASS').or(page.locator('text=FAIL')).first()
    ).toBeVisible({ timeout: 30_000 });
  });
});
