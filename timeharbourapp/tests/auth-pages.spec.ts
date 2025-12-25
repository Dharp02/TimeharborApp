import { test, expect } from '@playwright/test';

test.describe('Authentication Pages', () => {
  
  test.describe('Login Page', () => {
    test('should display login form with all elements', async ({ page }) => {
      await page.goto('/login');
      
      // Check page title and heading
      await expect(page).toHaveTitle(/TimeHarbour/);
      await expect(page.getByRole('heading', { name: 'TimeHarbour' })).toBeVisible();
      await expect(page.getByText('Sign in to track your time')).toBeVisible();
      
      // Check form elements
      await expect(page.getByLabel('Email')).toBeVisible();
      await expect(page.getByLabel('Password')).toBeVisible();
      await expect(page.getByRole('checkbox', { name: 'Remember me' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Forgot password?' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Sign up' })).toBeVisible();
    });

    test('should validate required fields', async ({ page }) => {
      await page.goto('/login');
      
      const emailInput = page.getByLabel('Email');
      const passwordInput = page.getByLabel('Password');
      const submitButton = page.getByRole('button', { name: 'Sign In' });
      
      // Try to submit empty form
      await submitButton.click();
      
      // HTML5 validation should prevent submission
      await expect(emailInput).toHaveAttribute('required');
      await expect(passwordInput).toHaveAttribute('required');
    });

    test('should fill and submit login form', async ({ page }) => {
      await page.goto('/login');
      
      // Fill in the form
      await page.getByLabel('Email').fill('test@example.com');
      await page.getByLabel('Password').fill('password123');
      await page.getByRole('checkbox', { name: 'Remember me' }).check();
      
      // Submit the form
      await page.getByRole('button', { name: 'Sign In' }).click();
      
      // Check loading state
      await expect(page.getByRole('button', { name: 'Signing in...' })).toBeVisible();
      
      // Wait for form to complete (simulated delay)
      await page.waitForTimeout(1100);
      await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
    });

    test('should navigate to signup page', async ({ page }) => {
      await page.goto('/login');
      
      await page.getByRole('link', { name: 'Sign up' }).click();
      await expect(page).toHaveURL('/signup');
    });

    test('should navigate to forgot password page', async ({ page }) => {
      await page.goto('/login');
      
      await page.getByRole('link', { name: 'Forgot password?' }).click();
      await expect(page).toHaveURL('/forgot-password');
    });
  });

  test.describe('Signup Page', () => {
    test('should display signup form with all elements', async ({ page }) => {
      await page.goto('/signup');
      
      // Check page heading
      await expect(page.getByRole('heading', { name: 'TimeHarbour' })).toBeVisible();
      await expect(page.getByText('Create an account to get started')).toBeVisible();
      
      // Check form elements
      await expect(page.getByLabel('Full Name')).toBeVisible();
      await expect(page.getByLabel('Email')).toBeVisible();
      await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
      await expect(page.getByLabel('Confirm Password')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Create Account' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
    });

    test('should validate required fields', async ({ page }) => {
      await page.goto('/signup');
      
      const nameInput = page.getByLabel('Full Name');
      const emailInput = page.getByLabel('Email');
      const passwordInput = page.getByLabel('Password', { exact: true });
      const confirmPasswordInput = page.getByLabel('Confirm Password');
      const submitButton = page.getByRole('button', { name: 'Create Account' });
      
      // Try to submit empty form
      await submitButton.click();
      
      // HTML5 validation should prevent submission
      await expect(nameInput).toHaveAttribute('required');
      await expect(emailInput).toHaveAttribute('required');
      await expect(passwordInput).toHaveAttribute('required');
      await expect(confirmPasswordInput).toHaveAttribute('required');
    });

    test('should fill and submit signup form', async ({ page }) => {
      await page.goto('/signup');
      
      // Fill in the form with a unique email to ensure success
      const uniqueEmail = `test-${Date.now()}@example.com`;
      await page.getByLabel('Full Name').fill('John Doe');
      await page.getByLabel('Email').fill(uniqueEmail);
      await page.getByLabel('Password', { exact: true }).fill('SecurePass123!');
      await page.getByLabel('Confirm Password').fill('SecurePass123!');
      
      // Submit the form
      await page.getByRole('button', { name: 'Create Account' }).click();
      
      // Check loading state
      await expect(page.getByRole('button', { name: 'Creating account...' })).toBeVisible();
      
      // Should redirect to dashboard on success
      await expect(page).toHaveURL('/dashboard');
    });

    test('should navigate to login page', async ({ page }) => {
      await page.goto('/signup');
      
      await page.getByRole('link', { name: 'Sign in' }).click();
      await expect(page).toHaveURL('/login');
    });

    test('should accept valid email format', async ({ page }) => {
      await page.goto('/signup');
      
      const emailInput = page.getByLabel('Email');
      
      // Test valid email
      await emailInput.fill('valid.email@example.com');
      await expect(emailInput).toHaveValue('valid.email@example.com');
    });
  });

  test.describe('Forgot Password Page', () => {
    test('should display forgot password form with all elements', async ({ page }) => {
      await page.goto('/forgot-password');
      
      // Check page heading
      await expect(page.getByRole('heading', { name: 'TimeHarbour' })).toBeVisible();
      
      
      // Check form elements
      await expect(page.getByLabel('Email Address')).toBeVisible();
      await expect(page.getByText("Enter your email address and we'll send you a link")).toBeVisible();
      await expect(page.getByRole('button', { name: 'Send Reset Link' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
    });

    test('should validate required email field', async ({ page }) => {
      await page.goto('/forgot-password');
      
      const emailInput = page.getByLabel('Email Address');
      const submitButton = page.getByRole('button', { name: 'Send Reset Link' });
      
      // Try to submit empty form
      await submitButton.click();
      
      // HTML5 validation should prevent submission
      await expect(emailInput).toHaveAttribute('required');
    });

    test('should fill and submit forgot password form', async ({ page }) => {
      await page.goto('/forgot-password');
      
      // Fill in email
      await page.getByLabel('Email Address').fill('reset@example.com');
      
      // Submit the form
      await page.getByRole('button', { name: 'Send Reset Link' }).click();
      
      // Check loading state
      await expect(page.getByRole('button', { name: 'Sending link...' })).toBeVisible();
      
      // Wait for form to complete (simulated delay)
      await page.waitForTimeout(1100);
      
      // Should show success message
      await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
      await expect(page.getByText(/We've sent a password reset link to/)).toBeVisible();
      await expect(page.getByText('reset@example.com')).toBeVisible();
      await expect(page.getByRole('link', { name: 'Back to Sign In' })).toBeVisible();
    });

    test('should display success state after submission', async ({ page }) => {
      await page.goto('/forgot-password');
      
      await page.getByLabel('Email Address').fill('success@example.com');
      await page.getByRole('button', { name: 'Send Reset Link' }).click();
      
      // Wait for success state
      await page.waitForTimeout(1100);
      
      // Verify success UI elements
      await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
      
      // Should have a checkmark icon (green background)
      const successIcon = page.locator('.bg-green-100');
      await expect(successIcon).toBeVisible();
      
      // Back to Sign In button should navigate to login
      await page.getByRole('link', { name: 'Back to Sign In' }).click();
      await expect(page).toHaveURL('/login');
    });

    test('should navigate to login page from link', async ({ page }) => {
      await page.goto('/forgot-password');
      
      await page.getByRole('link', { name: 'Sign in' }).click();
      await expect(page).toHaveURL('/login');
    });
  });

  test.describe('Navigation Flow', () => {
    test('should allow complete auth flow navigation', async ({ page }) => {
      // Start at login
      await page.goto('/login');
      await expect(page).toHaveURL('/login');
      
      // Navigate to signup
      await page.getByRole('link', { name: 'Sign up' }).click();
      await expect(page).toHaveURL('/signup');
      
      // Navigate back to login
      await page.getByRole('link', { name: 'Sign in' }).click();
      await expect(page).toHaveURL('/login');
      
      // Navigate to forgot password
      await page.getByRole('link', { name: 'Forgot password?' }).click();
      await expect(page).toHaveURL('/forgot-password');
      
      // Navigate back to login
      await page.getByRole('link', { name: 'Sign in' }).click();
      await expect(page).toHaveURL('/login');
    });

    test('should redirect from root to login', async ({ page }) => {
      await page.goto('/');
      await expect(page).toHaveURL('/login');
    });
  });

  test.describe('Responsive Design', () => {
    test('should display correctly on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/login');
      
      // Check that elements are still visible and accessible
      await expect(page.getByRole('heading', { name: 'TimeHarbour' })).toBeVisible();
      await expect(page.getByLabel('Email')).toBeVisible();
      await expect(page.getByLabel('Password')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
    });

    test('should display correctly on tablet viewport', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/signup');
      
      await expect(page.getByRole('heading', { name: 'TimeHarbour' })).toBeVisible();
      await expect(page.getByLabel('Full Name')).toBeVisible();
      await expect(page.getByLabel('Email')).toBeVisible();
    });
  });
});
