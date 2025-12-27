import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { TeamProvider } from '@/components/dashboard/TeamContext';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <TeamProvider>
      <DashboardLayout>{children}</DashboardLayout>
    </TeamProvider>
  );
}
