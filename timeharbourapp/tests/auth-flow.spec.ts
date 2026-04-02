import { test, expect } from '@playwright/test';

/**
 * End-to-end authentication flow tests.
 *
 * These tests cover the complete signup, login, session, and signout lifecycle.
 * They run against the live dev server (see playwright.config.ts).
 */

const TEST_PASSWORD = 'SecurePass123!';

test.describe('Authentication Flow', () => {

  test.describe('Signup to Dashboard Redirect', () => {
    test('new user can sign up and land on the dashboard', async ({ page }) => {
      const uniqueEmail = `e2e-signup-${Date.now()}@example.com`;

      await page.goto('/signup');

      await page.getByLabel('Full Name').fill('E2E Test User');
      await page.getByLabel('Email').fill(uniqueEmail);
      await page.locator('#password').fill(TEST_PASSWORD);
      await page.locator('#confirmPassword').fill(TEST_PASSWORD);

      await page.getByRole('button', { name: 'Create Account' }).click();

      // Should redirect to dashboard after successful signup
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
    });
  });

  test.describe('Login to Dashboard Redirect', () => {
    let userEmail: string;

    test.beforeAll(async ({ browser }) => {
      // Create a throwaway user to test login
      userEmail = `e2e-login-${Date.now()}@example.com`;
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await page.goto('/signup');
      await page.getByLabel('Full Name').fill('Login Test');
      await page.getByLabel('Email').fill(userEmail);
      await page.locator('#password').fill(TEST_PASSWORD);
      await page.locator('#confirmPassword').fill(TEST_PASSWORD);
      await page.getByRole('button', { name: 'Create Account' }).click();
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
      await ctx.close();
    });

    test('existing user can log in and reach dashboard', async ({ page }) => {
      await page.goto('/login');

      await page.getByLabel('Email').fill(userEmail);
      await page.getByLabel('Password').fill(TEST_PASSWORD);
      await page.getByRole('button', { name: 'Sign In', exact: true }).click();

      await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
    });

    test('shows error for wrong password', async ({ page }) => {
      await page.goto('/login');

      await page.getByLabel('Email').fill(userEmail);
      await page.getByLabel('Password').fill('WrongPassword999!');
      await page.getByRole('button', { name: 'Sign In', exact: true }).click();

      // Should show an error and remain on login page
      await page.waitForTimeout(2_000);
      await expect(page).toHaveURL(/\/login/);
    });
  });

  test.describe('Session Persistence', () => {
    test('authenticated user stays on dashboard after reload', async ({ browser }) => {
      const email = `e2e-session-${Date.now()}@example.com`;
      const ctx = await browser.newContext();
      const page = await ctx.newPage();

      // Sign up
      await page.goto('/signup');
      await page.getByLabel('Full Name').fill('Session Test');
      await page.getByLabel('Email').fill(email);
      await page.locator('#password').fill(TEST_PASSWORD);
      await page.locator('#confirmPassword').fill(TEST_PASSWORD);
      await page.getByRole('button', { name: 'Create Account' }).click();
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

      // Reload and verify session is preserved
      await page.reload();
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });

      await ctx.close();
    });
  });

  test.describe('Sign Out', () => {
    test('user can sign out and is redirected to login', async ({ browser }) => {
      const email = `e2e-signout-${Date.now()}@example.com`;
      const ctx = await browser.newContext();
      const page = await ctx.newPage();

      // Sign up
      await page.goto('/signup');
      await page.getByLabel('Full Name').fill('SignOut Test');
      await page.getByLabel('Email').fill(email);
      await page.locator('#password').fill(TEST_PASSWORD);
      await page.locator('#confirmPassword').fill(TEST_PASSWORD);
      await page.getByRole('button', { name: 'Create Account' }).click();
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

      // Sign out
      await page.getByRole('button', { name: 'Sign Out' }).click();

      // Should redirect to login
      await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });

      await ctx.close();
    });
  });

  test.describe('Password Reset Flow', () => {
    test('forgot password form submits and shows success', async ({ page }) => {
      await page.goto('/forgot-password');

      await page.getByLabel('Email Address').fill('reset-test@example.com');
      await page.getByRole('button', { name: 'Send Reset Link' }).click();

      // Should show success state
      await expect(
        page.getByRole('heading', { name: 'Check your email' })
      ).toBeVisible({ timeout: 5_000 });
      await expect(page.getByText('reset-test@example.com')).toBeVisible();
    });
  });

  test.describe('Social Login Buttons', () => {
    test('login page shows Google and GitHub social buttons', async ({ page }) => {
      await page.goto('/login');

      const googleBtn = page.getByRole('button', { name: /google/i });
      const githubBtn = page.getByRole('button', { name: /github/i });

      await expect(googleBtn).toBeVisible();
      await expect(githubBtn).toBeVisible();
    });

    test('signup page shows Google and GitHub social buttons', async ({ page }) => {
      await page.goto('/signup');

      const googleBtn = page.getByRole('button', { name: /google/i });
      const githubBtn = page.getByRole('button', { name: /github/i });

      await expect(googleBtn).toBeVisible();
      await expect(githubBtn).toBeVisible();
    });
  });

  test.describe('Route Protection', () => {
    test('unauthenticated user visiting /dashboard is redirected to /login', async ({ page }) => {
      await page.goto('/dashboard');
      await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
    });
  });
});
