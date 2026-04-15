import { type Page, type Locator } from '@playwright/test';
import { BasePage } from './base.page';

export class SignupPage extends BasePage {
  readonly fullNameInput: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly confirmPasswordInput: Locator;
  readonly createAccountButton: Locator;
  readonly loginLink: Locator;

  constructor(page: Page) {
    super(page);
    this.fullNameInput = page.getByLabel('Full Name');
    this.emailInput = page.getByLabel('Email');
    this.passwordInput = page.locator('#password');
    this.confirmPasswordInput = page.locator('#confirmPassword');
    this.createAccountButton = page.getByRole('button', { name: 'Create Account' });
    this.loginLink = page.getByRole('link', { name: /sign in|log in/i });
  }

  async navigate() {
    await this.goto('/signup');
  }

  async signup(name: string, email: string, password: string) {
    await this.fullNameInput.fill(name);
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.confirmPasswordInput.fill(password);
    await this.createAccountButton.click();
  }
}
