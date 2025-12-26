'use client';

import { useRouter } from 'next/navigation';
import { auth } from '@/TimeharborAPI';
import { useAuth } from '@/components/auth/AuthProvider';

export default function Dashboard() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const handleSignOut = async () => {
    await auth.signOut();
    // Redirect is handled by AuthProvider
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-xl font-semibold text-gray-700 dark:text-gray-200">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Welcome to Timeharbor
            </h1>
            <button
              onClick={handleSignOut}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
            >
              Sign Out
            </button>
          </div>

          <div className="space-y-6">
            <div className="p-6 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
              <h2 className="text-xl font-semibold text-blue-900 dark:text-blue-100 mb-2">
                User Profile
              </h2>
              <div className="space-y-2 text-gray-700 dark:text-gray-300">
                <p><span className="font-medium">Email:</span> {user?.email}</p>
                <p><span className="font-medium">Name:</span> {user?.user_metadata?.full_name}</p>
                <p><span className="font-medium">User ID:</span> {user?.id}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Recent Activity
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  No recent activity to show.
                </p>
              </div>
              <div className="p-6 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Upcoming Tasks
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  You have no upcoming tasks.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
