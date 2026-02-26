import type { NextConfig } from "next";
import path from "path";

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
  // Prevent webpack from walking up to the monorepo root's node_modules
  // when resolving CSS/PostCSS deps (e.g. tailwindcss). Without this,
  // enhanced-resolve finds /TimeharborApp/package.json and fails to locate
  // tailwindcss there, causing noisy errors on every CSS compile.
  webpack: (config) => {
    config.resolve.modules = [
      path.join(__dirname, 'node_modules'),
      'node_modules',
    ];
    return config;
  },
};

export default nextConfig;