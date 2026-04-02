import LoginForm from '@/components/auth/LoginForm';

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-primary-600 dark:text-primary-400 mb-2">
            TimeHarbor 
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Sign in to track your time
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
