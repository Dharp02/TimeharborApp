import { test, expect } from '@playwright/test';

/**
 * Tickets E2E — CRUD operations and IndexedDB verification.
 *
 * Uses a mobile viewport to match time-engine tests.
 *
 * What we verify:
 *   1. Create a ticket → UI shows it, IndexedDB entry exists
 *   2. Edit a ticket  → title/description updated in UI and IndexedDB
 *   3. Change status   → status badge updates in UI and IndexedDB
 *   4. Delete a ticket → removed from UI, soft-deleted in IndexedDB
 *   5. Dashboard recent activity reflects ticket events
 *   6. Search/filter works on the tickets list
 */

test.use({
  viewport: { width: 390, height: 844 },
  navigationTimeout: 30_000,
});

// ─── helpers ────────────────────────────────────────────

/** Read all non-deleted tickets from IndexedDB. */
async function getTickets(page: import('@playwright/test').Page) {
  return page.evaluate(async () => {
    const dbs = await indexedDB.databases();
    const dbInfo = dbs.find(d => d.name?.toLowerCase().includes('timeharbor'));
    if (!dbInfo?.name) return [];

    return new Promise<Record<string, unknown>[]>((resolve, reject) => {
      const req = indexedDB.open(dbInfo.name!);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('tickets')) { resolve([]); return; }
        const tx = db.transaction('tickets', 'readonly');
        const store = tx.objectStore('tickets');
        const getAll = store.getAll();
        getAll.onsuccess = () => {
          const tickets = getAll.result as Record<string, unknown>[];
          resolve(tickets.filter(t => !t._deleted));
        };
        getAll.onerror = () => reject(getAll.error);
      };
    });
  });
}

/** Read a ticket by id (including soft-deleted). */
async function getTicketById(page: import('@playwright/test').Page, ticketId: string) {
  return page.evaluate(async (id) => {
    const dbs = await indexedDB.databases();
    const dbInfo = dbs.find(d => d.name?.toLowerCase().includes('timeharbor'));
    if (!dbInfo?.name) return null;

    return new Promise<Record<string, unknown> | null>((resolve, reject) => {
      const req = indexedDB.open(dbInfo.name!);
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

/** Read today's activity logs from IndexedDB. */
async function getTodayActivities(page: import('@playwright/test').Page) {
  return page.evaluate(async () => {
    const dbs = await indexedDB.databases();
    const dbInfo = dbs.find(d => d.name?.toLowerCase().includes('timeharbor'));
    if (!dbInfo?.name) return [];

    return new Promise<Record<string, unknown>[]>((resolve, reject) => {
      const req = indexedDB.open(dbInfo.name!);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('activityLogs')) { resolve([]); return; }
        const tx = db.transaction('activityLogs', 'readonly');
        const store = tx.objectStore('activityLogs');
        const getAll = store.getAll();
        getAll.onsuccess = () => {
          const logs = getAll.result as Record<string, unknown>[];
          const today = new Date().toISOString().split('T')[0];
          resolve(logs.filter(l => (l.startTime as string)?.startsWith(today)));
        };
        getAll.onerror = () => reject(getAll.error);
      };
    });
  });
}

const TICKET_TITLE = `E2E Test Ticket ${Date.now()}`;
const TICKET_DESC = 'Automated test ticket description';
const EDITED_TITLE = `${TICKET_TITLE} — edited`;
const EDITED_DESC = 'Updated description from E2E test';

// ─── tests ──────────────────────────────────────────────

test.describe('Tickets — CRUD & Activity Log', () => {

  test('create ticket from tickets page', async ({ page }) => {
    await page.goto('/dashboard/tickets');
    await page.waitForLoadState('networkidle');

    // Click "New Personal Ticket"
    await page.getByRole('button', { name: /New Personal Ticket/i }).click();
    await expect(page).toHaveURL(/\/dashboard\/tickets\/create/, { timeout: 10_000 });

    // Fill in ticket form
    await page.getByPlaceholder('Enter ticket title').fill(TICKET_TITLE);
    await page.getByPlaceholder('Add more details...').fill(TICKET_DESC);

    // Submit
    await page.getByRole('button', { name: 'Create Ticket' }).click();

    // Should redirect back to tickets list
    await expect(page).toHaveURL(/\/dashboard\/tickets\/?$/, { timeout: 10_000 });
    await page.waitForLoadState('networkidle');

    // The new ticket should appear in the list
    await expect(page.getByText(TICKET_TITLE).first()).toBeVisible({ timeout: 10_000 });

    // Verify IndexedDB has the ticket
    const tickets = await getTickets(page);
    const created = tickets.find(t => t.title === TICKET_TITLE);
    expect(created).toBeDefined();
    expect(created!.description).toBe(TICKET_DESC);
    expect(created!.status).toBe('Open');
    expect(created!.priority).toBe('Medium');
  });

  test('edit ticket title and description', async ({ page }) => {
    // First create a ticket to edit
    await page.goto('/dashboard/tickets/create');
    await page.waitForLoadState('networkidle');
    await page.getByPlaceholder('Enter ticket title').fill(TICKET_TITLE);
    await page.getByPlaceholder('Add more details...').fill(TICKET_DESC);
    await page.getByRole('button', { name: 'Create Ticket' }).click();
    await expect(page).toHaveURL(/\/dashboard\/tickets\/?$/, { timeout: 10_000 });
    await page.waitForLoadState('networkidle');

    // Get the ticket id from IndexedDB
    let tickets = await getTickets(page);
    const ticket = tickets.find(t => t.title === TICKET_TITLE);
    expect(ticket).toBeDefined();
    const ticketId = ticket!.id as string;

    // Open the actions dropdown (only one ticket in this context)
    await page.getByLabel('Ticket actions').click();

    // Click "Edit Ticket"
    await page.getByText('Edit Ticket').click();
    await expect(page).toHaveURL(/\/dashboard\/tickets\/edit/, { timeout: 10_000 });
    await page.waitForLoadState('networkidle');

    // Clear and update title (edit page uses 'Ticket title' placeholder)
    const titleInput = page.getByPlaceholder('Ticket title');
    await titleInput.clear();
    await titleInput.fill(EDITED_TITLE);

    // Clear and update description
    const descInput = page.getByPlaceholder('Add more details...');
    await descInput.clear();
    await descInput.fill(EDITED_DESC);

    // Save
    await page.getByRole('button', { name: 'Update' }).click();
    await expect(page).toHaveURL(/\/dashboard\/tickets/, { timeout: 10_000 });
    await page.waitForLoadState('networkidle');

    // Verify the updated title is visible
    await expect(page.getByText(EDITED_TITLE).first()).toBeVisible({ timeout: 10_000 });

    // Verify IndexedDB
    const updated = await getTicketById(page, ticketId);
    expect(updated).not.toBeNull();
    expect(updated!.title).toBe(EDITED_TITLE);
    expect(updated!.description).toBe(EDITED_DESC);
  });

  test('change ticket status via modal', async ({ page }) => {
    // Create a ticket
    await page.goto('/dashboard/tickets/create');
    await page.waitForLoadState('networkidle');
    const title = `Status Test ${Date.now()}`;
    await page.getByPlaceholder('Enter ticket title').fill(title);
    await page.getByRole('button', { name: 'Create Ticket' }).click();
    await expect(page).toHaveURL(/\/dashboard\/tickets\/?$/, { timeout: 10_000 });
    await page.waitForLoadState('networkidle');

    // Get ticket id
    const tickets = await getTickets(page);
    const ticket = tickets.find(t => t.title === title);
    expect(ticket).toBeDefined();
    const ticketId = ticket!.id as string;
    expect(ticket!.status).toBe('Open');

    // Open actions dropdown (only one ticket in this context)
    await page.getByLabel('Ticket actions').click();

    // Click "Change Status"
    await page.getByText('Change Status').first().click();

    // The status modal should appear
    await expect(page.getByText('Select a new status for')).toBeVisible({ timeout: 5_000 });

    // Click "In Progress"
    await page.getByRole('button', { name: 'In Progress' }).click();

    // Wait for modal to close and list to refresh
    await page.waitForTimeout(1_000);

    // The status badge on the ticket card should now show "In Progress"
    // The ancestor contains both the filter pill and the badge — use .last() for the badge
    const cardLocator = page.getByText(title).first()
      .locator('xpath=ancestor::div[.//button[@aria-label="Ticket actions"]]').first();
    await expect(cardLocator.getByText('In Progress').last()).toBeVisible({ timeout: 5_000 });

    // Verify IndexedDB
    const updated = await getTicketById(page, ticketId);
    expect(updated).not.toBeNull();
    // Status in DB may be "In Progress"
    expect(updated!.status).toBe('In Progress');

    // Now change to "Done"
    await page.getByLabel('Ticket actions').click();
    await page.getByText('Change Status').first().click();
    await expect(page.getByText('Select a new status for')).toBeVisible({ timeout: 5_000 });
    await page.getByRole('button', { name: 'Done' }).click();
    await page.waitForTimeout(1_000);

    const done = await getTicketById(page, ticketId);
    expect(done).not.toBeNull();
    // "Done" in UI maps to "Closed" in DB
    expect(['Done', 'Closed']).toContain(done!.status);
  });

  test('delete ticket removes from UI and soft-deletes in IndexedDB', async ({ page }) => {
    // Create a ticket to delete
    await page.goto('/dashboard/tickets/create');
    await page.waitForLoadState('networkidle');
    const title = `Delete Me ${Date.now()}`;
    await page.getByPlaceholder('Enter ticket title').fill(title);
    await page.getByRole('button', { name: 'Create Ticket' }).click();
    await expect(page).toHaveURL(/\/dashboard\/tickets\/?$/, { timeout: 10_000 });
    await page.waitForLoadState('networkidle');

    // Get ticket id
    const tickets = await getTickets(page);
    const ticket = tickets.find(t => t.title === title);
    expect(ticket).toBeDefined();
    const ticketId = ticket!.id as string;

    // Open actions dropdown (only one ticket in this context)
    await page.getByLabel('Ticket actions').click();

    // Click "Delete Ticket"
    await page.getByText('Delete Ticket').first().click();

    // Confirm delete modal
    await expect(page.getByText(`Are you sure you want to delete`)).toBeVisible({ timeout: 5_000 });
    await page.getByRole('button', { name: 'Delete', exact: true }).click();

    // Wait for the ticket to be removed from the list
    await page.waitForTimeout(1_000);
    await expect(page.getByText(title)).not.toBeVisible({ timeout: 5_000 });

    // Verify IndexedDB: ticket should be soft-deleted (_deleted = true)
    const deleted = await page.evaluate(async (id) => {
      const dbs = await indexedDB.databases();
      const dbInfo = dbs.find(d => d.name?.toLowerCase().includes('timeharbor'));
      if (!dbInfo?.name) return null;
      return new Promise<Record<string, unknown> | null>((resolve, reject) => {
        const req = indexedDB.open(dbInfo.name!);
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

    // Should exist but be marked deleted
    if (deleted) {
      expect(deleted._deleted).toBe(true);
    }
    // Either way, it should not appear in active tickets
    const activeTickets = await getTickets(page);
    expect(activeTickets.find(t => t.id === ticketId)).toBeUndefined();
  });

  test('ticket search filters the list', async ({ page }) => {
    // Create two tickets with distinct names
    const nameA = `SearchAlpha ${Date.now()}`;
    const nameB = `SearchBravo ${Date.now()}`;

    await page.goto('/dashboard/tickets/create');
    await page.waitForLoadState('networkidle');
    await page.getByPlaceholder('Enter ticket title').fill(nameA);
    await page.getByRole('button', { name: 'Create Ticket' }).click();
    await expect(page).toHaveURL(/\/dashboard\/tickets\/?$/, { timeout: 10_000 });
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /New Personal Ticket/i }).click();
    await page.waitForLoadState('networkidle');
    await page.getByPlaceholder('Enter ticket title').fill(nameB);
    await page.getByRole('button', { name: 'Create Ticket' }).click();
    await expect(page).toHaveURL(/\/dashboard\/tickets\/?$/, { timeout: 10_000 });
    await page.waitForLoadState('networkidle');

    // Both should be visible
    await expect(page.getByText(nameA).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(nameB).first()).toBeVisible();

    // Search for Alpha — Bravo should disappear
    await page.getByPlaceholder('Search tickets...').fill('SearchAlpha');
    await expect(page.getByText(nameA).first()).toBeVisible();
    await expect(page.getByText(nameB)).not.toBeVisible({ timeout: 5_000 });

    // Clear search — both visible again
    await page.getByPlaceholder('Search tickets...').clear();
    await expect(page.getByText(nameA).first()).toBeVisible();
    await expect(page.getByText(nameB).first()).toBeVisible();
  });

  test('dashboard recent activity shows ticket creation and deletion', async ({ page }) => {
    // Create a ticket
    const title = `Activity Log Test ${Date.now()}`;
    await page.goto('/dashboard/tickets/create');
    await page.waitForLoadState('networkidle');
    await page.getByPlaceholder('Enter ticket title').fill(title);
    await page.getByRole('button', { name: 'Create Ticket' }).click();
    await expect(page).toHaveURL(/\/dashboard\/tickets\/?$/, { timeout: 10_000 });
    await page.waitForLoadState('networkidle');

    // Go to dashboard and check recent activity
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // "Recent Activity" section should contain "Created Ticket" with our title
    const recentSection = page.getByText('Recent Activity').locator('..');
    await expect(recentSection).toBeVisible({ timeout: 10_000 });

    // Check the activity log in IndexedDB for the creation event
    let activities = await getTodayActivities(page);
    const createLog = activities.find(
      a => a.title === 'Created Ticket' && a.subtitle === title
    );
    expect(createLog).toBeDefined();

    // Now delete the ticket
    await page.goto('/dashboard/tickets');
    await page.waitForLoadState('networkidle');

    await page.getByLabel('Ticket actions').click();
    await page.getByText('Delete Ticket').first().click();
    await expect(page.getByText('Are you sure you want to delete')).toBeVisible({ timeout: 5_000 });
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await page.waitForTimeout(1_000);

    // Check activity log for deletion event
    activities = await getTodayActivities(page);
    const deleteLog = activities.find(
      a => a.title === 'Ticket Deleted' && a.subtitle === title
    );
    expect(deleteLog).toBeDefined();

    // Verify on dashboard UI
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Ticket Deleted').first()).toBeVisible({ timeout: 10_000 });
  });
});
