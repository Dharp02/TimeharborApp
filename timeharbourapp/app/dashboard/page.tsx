'use client';

import { useAuth } from '@/components/auth/AuthProvider';

export default function Dashboard() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-xl font-semibold text-gray-700 dark:text-gray-200">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
          Dashboard Overview
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="p-6 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
            <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">
              Total Hours
            </h3>
            <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">0h 0m</p>
            <p className="text-sm text-blue-600/60 dark:text-blue-400/60 mt-1">This week</p>
          </div>
          
          <div className="p-6 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-100 dark:border-purple-800">
            <h3 className="text-lg font-semibold text-purple-900 dark:text-purple-100 mb-2">
              Active Tasks
            </h3>
            <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">0</p>
            <p className="text-sm text-purple-600/60 dark:text-purple-400/60 mt-1">In progress</p>
          </div>

          <div className="p-6 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-100 dark:border-green-800">
            <h3 className="text-lg font-semibold text-green-900 dark:text-green-100 mb-2">
              Team Members
            </h3>
            <p className="text-3xl font-bold text-green-600 dark:text-green-400">1</p>
            <p className="text-sm text-green-600/60 dark:text-green-400/60 mt-1">Online now</p>
          </div>
        </div>
      </div>
    </div>
  );
}
