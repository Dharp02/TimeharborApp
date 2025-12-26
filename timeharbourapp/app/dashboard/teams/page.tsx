'use client';

import { Users, Plus } from 'lucide-react';

export default function TeamsPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Teams</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button className="flex items-center justify-center gap-3 p-6 rounded-xl border-2 border-blue-100 dark:border-blue-900 hover:border-blue-500 dark:hover:border-blue-500 bg-blue-50 dark:bg-blue-900/20 transition-all group">
          <div className="p-3 bg-blue-100 dark:bg-blue-800 rounded-full group-hover:bg-blue-200 dark:group-hover:bg-blue-700 transition-colors">
            <Users className="w-6 h-6 text-blue-600 dark:text-blue-300" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-gray-900 dark:text-white">Join a Team</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Find your team and start collaborating</p>
          </div>
        </button>

        <button className="flex items-center justify-center gap-3 p-6 rounded-xl border-2 border-purple-100 dark:border-purple-900 hover:border-purple-500 dark:hover:border-purple-500 bg-purple-50 dark:bg-purple-900/20 transition-all group">
          <div className="p-3 bg-purple-100 dark:bg-purple-800 rounded-full group-hover:bg-purple-200 dark:group-hover:bg-purple-700 transition-colors">
            <Plus className="w-6 h-6 text-purple-600 dark:text-purple-300" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-gray-900 dark:text-white">Create a Team</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Set up a new workspace for your team</p>
          </div>
        </button>
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Your Teams</h2>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 text-center text-gray-500 dark:text-gray-400">
          <p>You haven't joined any teams yet.</p>
        </div>
      </div>
    </div>
  );
}
