import { type Page, type Locator } from '@playwright/test';

/**
 * Base page object — common navigation and utility methods.
 */
export class BasePage {
  constructor(protected readonly page: Page) {}

  async goto(path: string) {
    await this.page.goto(path);
    await this.page.waitForLoadState('networkidle');
  }

  async currentUrl(): Promise<string> {
    return this.page.url();
  }

  get brandName(): Locator {
    return this.page.getByText('TimeHarbor').first();
  }
}
