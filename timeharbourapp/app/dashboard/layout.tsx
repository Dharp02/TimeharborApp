import { TeamProvider } from '@/components/dashboard/TeamContext';
import { ActivityLogProvider } from '@/components/dashboard/ActivityLogContext';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { RefreshProvider } from '../../contexts/RefreshContext';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <RefreshProvider>
      <TeamProvider>
        <ActivityLogProvider>
          <DashboardLayout>{children}</DashboardLayout>
        </ActivityLogProvider>
      </TeamProvider>
    </RefreshProvider>
  );
}
