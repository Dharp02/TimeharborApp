import { Suspense } from 'react';
import ResetPasswordForm from '@/components/auth/ResetPasswordForm';

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-primary-600 dark:text-primary-400 mb-2">
            TimeHarbor
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Choose a new password
          </p>
        </div>
        <Suspense fallback={<div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 animate-pulse h-64" />}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
