import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('should allow user to sign up, sign out, and sign in', async ({ page }) => {
    const uniqueEmail = `flow-test-${Date.now()}@example.com`;
    const password = 'SecurePass123!';
    const name = 'Flow Test User';

    // 1. Sign Up
    await page.goto('/signup');
    await expect(page).toHaveTitle(/TimeHarbour/);

    await page.getByLabel('Full Name').fill(name);
    await page.getByLabel('Email').fill(uniqueEmail);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByLabel('Confirm Password').fill(password);

    await page.getByRole('button', { name: 'Create Account' }).click();

    // Expect redirection to dashboard
    await expect(page).toHaveURL('/dashboard');
    await expect(page.getByRole('heading', { name: 'Welcome to Timeharbor' })).toBeVisible();
    await expect(page.getByText(uniqueEmail)).toBeVisible(); // Assuming email is displayed in profile

    // 2. Sign Out
    await page.getByRole('button', { name: 'Sign Out' }).click();
    await expect(page).toHaveURL('/login');

    // 3. Sign In
    await page.getByLabel('Email').fill(uniqueEmail);
    await page.getByLabel('Password').fill(password);
    // Uncheck "Remember me" to ensure clean session if needed, but default is unchecked usually.
    
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Expect redirection to dashboard
    await expect(page).toHaveURL('/dashboard');
    await expect(page.getByRole('heading', { name: 'Welcome to Timeharbor' })).toBeVisible();
  });
});
