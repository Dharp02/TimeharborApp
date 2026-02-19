import { TeamProvider } from '@/components/dashboard/TeamContext';
import { ActivityLogProvider } from '@/components/dashboard/ActivityLogContext';
import DashboardLayout from '@/components/dashboard/DashboardLayout';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <TeamProvider>
      <ActivityLogProvider>
        <DashboardLayout>{children}</DashboardLayout>
      </ActivityLogProvider>
    </TeamProvider>
  );
}
