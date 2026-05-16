import type { Metadata } from "next";
import "./globals.css";
import AppSessionProvider from "@/components/AppSessionProvider";
import { NotificationProvider } from "@/contexts/NotificationContext";
import ThemeWrapper from "@/components/ThemeWrapper";
import AppLockGuard from "@/components/AppLockGuard";

// const geistSans = Geist({
//   variable: "--font-geist-sans",
//   subsets: ["latin"],
// });

// const geistMono = Geist_Mono({
//   variable: "--font-geist-mono",
//   subsets: ["latin"],
// });

export const metadata: Metadata = {
  title: "TimeHarbour - Time Tracking App",
  description: "Track your time efficiently with TimeHarbour",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
   
      </head>
      <body className="antialiased">
        <ThemeWrapper>
          <AppSessionProvider>
            <NotificationProvider>
              <AppLockGuard>
                {children}
              </AppLockGuard>
            </NotificationProvider>
          </AppSessionProvider>
        </ThemeWrapper>
      </body>
    </html>
  );
}
