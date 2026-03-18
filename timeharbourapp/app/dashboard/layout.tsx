import { Suspense } from 'react';
import { ActivityLogProvider } from '@/components/dashboard/ActivityLogContext';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { RefreshProvider } from '../../contexts/RefreshContext';

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
