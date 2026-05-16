'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { auth } from '@/TimeharborAPI';
import { Input, Button, Checkbox, Alert, AlertDescription } from '@mieweb/ui';
import { Github } from 'lucide-react';

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const { error, data } = await auth.signIn(email, password);
      if (error) {
        if (error.details && Array.isArray(error.details)) {
          const errorMessages = error.details.map(d => d.message).join(', ');
          setError(errorMessages);
        } else {
          setError(error.message);
        }
        setIsLoading(false);
      } else if (data) {
        // Success - AppSessionProvider will handle redirect
      }
    } catch (err) {
      setError('An unexpected error occurred');
      setIsLoading(false);
    }
  };

  const handleSocialLogin = async (provider: 'google' | 'github') => {
    setSocialLoading(provider);
    setError(null);
    try {
      const fn = provider === 'google' ? auth.signInWithGoogle : auth.signInWithGithub;
      const { error } = await fn();
      if (error) setError(error.message);
    } catch {
      setError(`Failed to sign in with ${provider}`);
    } finally {
      setSocialLoading(null);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <Alert variant="danger">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <Input
          id="email"
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="you@example.com"
          autoComplete="email"
        />

        <Input
          id="password"
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          placeholder="••••••••"
          autoComplete="current-password"
        />

        <div className="flex items-center justify-between">
          <Checkbox label="Remember me" />
          <Link
            href="/forgot-password"
            className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
          >
            Forgot password?
          </Link>
        </div>

        <Button
          type="submit"
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? 'Signing in...' : 'Sign In'}
        </Button>

        <div className="relative my-2">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300 dark:border-gray-600" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-white dark:bg-gray-800 px-2 text-gray-500 dark:text-gray-400">
              Or continue with
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={!!socialLoading}
            onClick={() => handleSocialLogin('google')}
            className="w-full"
            aria-label="Sign in with Google"
          >
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            {socialLoading === 'google' ? 'Loading...' : 'Google'}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!!socialLoading}
            onClick={() => handleSocialLogin('github')}
            className="w-full"
            aria-label="Sign in with GitHub"
          >
            <Github className="mr-2 h-4 w-4" />
            {socialLoading === 'github' ? 'Loading...' : 'GitHub'}
          </Button>
        </div>
      </form>
    </div>
  );
}
