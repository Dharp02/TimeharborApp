import { type Page, type Locator } from '@playwright/test';
import { BasePage } from './base.page';

export class DashboardPage extends BasePage {
  readonly signOutButton: Locator;
  readonly timeTrackerButton: Locator;
  readonly ticketsButton: Locator;
  readonly settingsButton: Locator;
  readonly totalHoursHeading: Locator;
  readonly readyToWork: Locator;

  constructor(page: Page) {
    super(page);
    this.signOutButton = page.getByRole('button', { name: 'Sign Out' });
    this.timeTrackerButton = page.getByRole('button', { name: 'Time Tracker' }).first();
    this.ticketsButton = page.getByRole('button', { name: 'Tickets' }).first();
    this.settingsButton = page.getByRole('button', { name: 'Settings' }).first();
    this.totalHoursHeading = page.getByRole('heading', { name: 'Total Hours' });
    this.readyToWork = page.getByText('Ready to Work?');
  }

  async navigate() {
    await this.goto('/dashboard');
  }

  sidebarButton(label: string): Locator {
    return this.page.getByRole('button', { name: label }).first();
  }

  async navigateVia(label: string) {
    await this.sidebarButton(label).click();
  }
}
