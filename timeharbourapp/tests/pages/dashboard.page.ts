import { type Page, type Locator } from '@playwright/test';
import { BasePage } from './base.page';

export class DashboardPage extends BasePage {
  readonly clearCacheButton: Locator;
  readonly timeTrackerButton: Locator;
  readonly ticketsButton: Locator;
  readonly settingsButton: Locator;
  readonly totalHoursHeading: Locator;
  readonly readyToWork: Locator;
  readonly clockInLabel: Locator;

  constructor(page: Page) {
    super(page);
    this.clearCacheButton = page.getByRole('button', { name: 'Clear Cache' });
    this.timeTrackerButton = page.getByRole('button', { name: 'Time Tracker' }).first();
    this.ticketsButton = page.getByRole('button', { name: 'Tickets' }).first();
    this.settingsButton = page.getByRole('button', { name: 'Settings' }).first();
    this.totalHoursHeading = page.getByRole('heading', { name: 'Total Hours' });
    this.readyToWork = page.getByText('Ready to Work?');
    this.clockInLabel = page.getByText('Clock In').first();
  }

  async navigate() {
    await this.goto('/dashboard');
  }

  sidebarButton(label: string): Locator {
    return this.page.getByRole('button', { name: label }).first();
  }

  /** Open the mobile sidebar overlay via the hamburger toggle. */
  async openMobileSidebar() {
    const toggle = this.page.getByRole('button', { name: 'Open navigation' });
    await toggle.click();
    // Wait for sidebar overlay to appear
    await this.page.waitForTimeout(300);
  }

  async navigateVia(label: string) {
    await this.sidebarButton(label).click();
  }
}
