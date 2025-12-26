'use client';

import { useAuth } from '@/components/auth/AuthProvider';
import { auth } from '@/TimeharborAPI';
import { LogOut, User, Mail, Shield } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function SettingsPage() {
  const { user } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    await auth.signOut();
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 pt-8 md:pt-0">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>

      {/* Profile Section */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6 space-y-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-4">
          Profile Information
        </h2>
        
        <div className="space-y-4">
          <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
              <User className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Full Name</p>
              <p className="font-medium text-gray-900 dark:text-white">
                {user?.user_metadata?.full_name || 'Not set'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-full">
              <Mail className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Email Address</p>
              <p className="font-medium text-gray-900 dark:text-white">{user?.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
              <Shield className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">User ID</p>
              <p className="font-medium text-gray-900 dark:text-white font-mono text-xs">
                {user?.id}
              </p>
            </div>
          </div>
        </div>

        <button className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors">
          Edit Profile
        </button>
      </div>

      {/* Account Actions */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6 md:hidden">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-4 mb-6">
          Account Actions
        </h2>
        
        <button
          onClick={handleSignOut}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl font-medium transition-colors border border-red-200 dark:border-red-800"
        >
          <LogOut className="w-5 h-5" />
          Sign Out
        </button>
      </div>
    </div>
  );
}
