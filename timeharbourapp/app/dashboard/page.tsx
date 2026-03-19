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
      <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-[var(--mieweb-card)] border border-[var(--mieweb-border)] mb-2">
        <div className="flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-[var(--mieweb-primary-500)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          <span className="text-sm font-semibold text-[var(--mieweb-foreground)]">Timehuddle</span>
        </div>
        <span className="text-xs font-medium text-[var(--mieweb-primary-500)] border border-[var(--mieweb-primary-500)]/50 rounded-full px-3 py-1">via Timehuddle</span>
      </div>
      <StoriesBar />
      
      <div className="space-y-3 md:space-y-6 pb-20 md:pb-0 mt-2 md:mt-3">
        <DashboardSummary />

        <OpenTickets />
        
        <RecentActivity />
      </div>
    </>
  );
}
