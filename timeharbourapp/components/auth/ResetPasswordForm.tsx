'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { resetPassword, clearStoredSession } from '@/TimeharborAPI/auth';
import { Input, Button, Alert, AlertDescription } from '@mieweb/ui';

export default function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Invalid or missing reset token. Please request a new password reset link.');
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (!token) {
      setError('Invalid or missing reset token.');
      return;
    }

    setIsLoading(true);
    const { error: apiError } = await resetPassword(token, password);
    setIsLoading(false);

    if (apiError) {
      setError(apiError.message);
      return;
    }

    setIsSuccess(true);
    // Clear any existing session so the user logs in fresh as the
    // account whose password was just reset, not a previously cached one.
    await clearStoredSession();
    setTimeout(() => router.push('/login'), 3000);
  };

  if (isSuccess) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center">
        <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Password updated!</h3>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Your password has been reset. Redirecting you to sign in…
        </p>
        <Link
          href="/login"
          className="inline-block w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 rounded-lg transition duration-200 shadow-lg hover:shadow-xl"
        >
          Go to Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
      <form onSubmit={handleSubmit} className="space-y-6" aria-label="Reset password form">
        {error && (
          <Alert variant="danger">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div>
          <Input
            id="password"
            label="New Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            aria-describedby="password-hint"
            placeholder="At least 8 characters"
          />
          <p id="password-hint" className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Must be at least 8 characters and include uppercase, lowercase, and a number.
          </p>
        </div>

        <Input
          id="confirm-password"
          label="Confirm New Password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          placeholder="Repeat your new password"
        />

        <Button
          type="submit"
          disabled={isLoading || !token}
          className="w-full"
        >
          {isLoading ? 'Updating password…' : 'Set New Password'}
        </Button>

        <div className="text-center text-sm text-gray-600 dark:text-gray-400">
          <Link href="/forgot-password" className="text-primary-600 dark:text-primary-400 hover:underline font-medium">
            Request a new reset link
          </Link>
        </div>
      </form>
    </div>
  );
}
