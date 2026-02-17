import type { Metadata } from "next";
// Temporarily disabled Google Fonts due to build issues - can re-enable later
// import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AuthProvider from "@/components/auth/AuthProvider";
import SyncInitializer from "@/components/SyncInitializer";
import { NotificationProvider } from "@/contexts/NotificationContext";

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
    <html lang="en">
      <body className="antialiased">
        <AuthProvider>
          <NotificationProvider>
            <SyncInitializer />
            {children}
          </NotificationProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
