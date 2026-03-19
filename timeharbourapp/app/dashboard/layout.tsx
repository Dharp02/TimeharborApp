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
        <Suspense fallback={null}>
          <DashboardLayout>{children}</DashboardLayout>
        </Suspense>
      </ActivityLogProvider>
    </RefreshProvider>
  );
}
