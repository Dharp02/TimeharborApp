import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === 'production';

const nextConfig: NextConfig = {
  // Enable static export only for Capacitor production builds.
  // In dev mode this causes Turbopack to treat every route as a static
  // export candidate, triggering extra compilation on every page visit.
  ...(isProduction ? { output: 'export' } : {}),
  images: {
    unoptimized: true,
  },
  // Ensure trailing slashes for better routing
  trailingSlash: true,
  // Fix "multiple lockfiles" warning — tell Turbopack the workspace root
  // is this package, not the monorepo root
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;