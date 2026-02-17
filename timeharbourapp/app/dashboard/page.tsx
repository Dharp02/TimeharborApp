'use client';

import { useAuth } from '@/components/auth/AuthProvider';
import dynamic from 'next/dynamic';
import StoriesBar from '@/components/dashboard/StoriesBar';

const DashboardSummary = dynamic(() => import('@/components/dashboard/DashboardSummary'), {
  loading: () => <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6 animate-pulse">
    {[...Array(4)].map((_, i) => (
      <div key={i} className="h-32 bg-gray-100 dark:bg-gray-800 rounded-xl" />
    ))}
  </div>
});

const OpenTickets = dynamic(() => import('@/components/dashboard/OpenTickets'), {
  loading: () => <div className="h-64 bg-white dark:bg-gray-800 rounded-2xl shadow-sm animate-pulse" />
});

const RecentActivity = dynamic(() => import('@/components/dashboard/RecentActivity'), {
  loading: () => <div className="h-64 bg-white dark:bg-gray-800 rounded-2xl shadow-sm animate-pulse" />
});

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
    <>
      <StoriesBar />
      
      <div className="space-y-6 pb-20 md:pb-0 mt-6">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-4 md:p-6">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white mb-4 md:mb-6">
          Dashboard Overview
        </h1>
        <DashboardSummary />
      </div>

      <OpenTickets />
      
      <RecentActivity />
      </div>
    </>
  );
}
