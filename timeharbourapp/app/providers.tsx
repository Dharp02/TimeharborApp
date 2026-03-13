'use client';

import { ThemeProvider } from '@mieweb/ui';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider defaultTheme="system" storageKey="timeharbor-theme">
      {children}
    </ThemeProvider>
  );
}
