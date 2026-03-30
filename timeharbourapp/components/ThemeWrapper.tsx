'use client';

import { ThemeProvider, ToastProvider, Toast, useToast } from '@mieweb/ui';

function ToastRenderer() {
  const { toasts, dismiss } = useToast();
  if (toasts.length === 0) return null;
  return (
    <div
      className="pointer-events-none fixed z-50 flex flex-col gap-2 left-1/2 -translate-x-1/2 items-center top-[7.5rem] lg:top-20"
      aria-live="polite"
      aria-atomic="true"
    >
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <Toast {...t} onClose={() => dismiss(t.id)} />
        </div>
      ))}
    </div>
  );
}

export default function ThemeWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider defaultTheme="system">
      <ToastProvider>
        {children}
        <ToastRenderer />
      </ToastProvider>
    </ThemeProvider>
  );
}
