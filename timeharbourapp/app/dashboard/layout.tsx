'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { ActivityLogProvider } from '@/components/dashboard/ActivityLogContext';
import { RefreshProvider } from '../../contexts/RefreshContext';

// Dynamic import with ssr:false prevents hydration mismatch caused by
// @mieweb/ui's useMediaQuery reading window.matchMedia during useState init,
// which returns different values on server (false) vs client (actual match).
const DashboardLayout = dynamic(
  () => import('@/components/dashboard/DashboardLayout'),
  { ssr: false }
);

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <RefreshProvider>
      <ActivityLogProvider>
        <Suspense fallback={
          <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
            <span className="text-2xl font-bold text-primary-500">⏱ TimeHarbor</span>
            <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
          </div>
        }>
          <DashboardLayout>{children}</DashboardLayout>
        </Suspense>
      </ActivityLogProvider>
    </RefreshProvider>
  );
}
