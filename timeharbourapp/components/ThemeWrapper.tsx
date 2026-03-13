'use client';

import { ThemeProvider } from '@mieweb/ui';

export default function ThemeWrapper({ children }: { children: React.ReactNode }) {
  return <ThemeProvider defaultTheme="system">{children}</ThemeProvider>;
}
