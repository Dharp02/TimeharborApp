'use client';

import { useAuth } from '@/components/auth/AuthProvider';
import DashboardSummary from '@/components/dashboard/DashboardSummary';
import OpenTickets from '@/components/dashboard/OpenTickets';
import RecentActivity from '@/components/dashboard/RecentActivity';

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
    <div className="space-y-6 pb-20 md:pb-0">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-4 md:p-6">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white mb-4 md:mb-6">
          Dashboard Overview
        </h1>
        <DashboardSummary />
      </div>

      <OpenTickets />
      
      <RecentActivity />
    </div>
  );
}
