import type { Metadata } from "next";
import "./globals.css";
import AuthProvider from "@/components/auth/AuthProvider";
import { NotificationProvider } from "@/contexts/NotificationContext";
import ThemeWrapper from "@/components/ThemeWrapper";

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
          <AuthProvider>
            <NotificationProvider>
              {children}
            </NotificationProvider>
          </AuthProvider>
        </ThemeWrapper>
      </body>
    </html>
  );
}
