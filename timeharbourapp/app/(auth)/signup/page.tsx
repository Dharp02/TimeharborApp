import SignupForm from '@/components/auth/SignupForm';

export default function SignupPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-blue-600 dark:text-blue-400 mb-2">
            TimeHarbor
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Create an account to get started
          </p>
        </div>
        <SignupForm />
      </div>
    </div>
  );
}
