'use client';

import { useAuth } from '@/components/auth/AuthProvider';
import { User, Mail, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function ProfilePage() {
  const { user } = useAuth();

  return (
    <div className="p-4 space-y-6 md:hidden">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/settings" className="p-2 -ml-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full">
          <ArrowLeft className="w-6 h-6 text-gray-900 dark:text-white" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Profile</h1>
      </div>

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
                {user?.full_name || 'Not set'}
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
        </div>
      </div>
    </div>
  );
}
