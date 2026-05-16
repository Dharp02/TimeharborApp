import type { NextConfig } from "next";
import path from "path";
import pkg from "./package.json" with { type: "json" };

// output: 'export' is ONLY for Capacitor (iOS/Android) native builds.
// Server deployments (UAT, prod) use `next start` and must NOT set this —
// `next start` crashes if output is 'export'. Set CAPACITOR_BUILD=true in
// the prod:ios / prod:android npm scripts to opt in.
const isCapacitorBuild = process.env.CAPACITOR_BUILD === 'true';

const nextConfig: NextConfig = {
  // Expose the package.json version so components can display it
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
    NEXT_PUBLIC_APP_BUILD: String(pkg.build ?? ''),
  },
  // Transpile @timeharbor/time-engine (linked from sibling workspace)
  transpilePackages: ['@timeharbor/time-engine'],
  // Allow cross-origin dev requests from the local machine IP (for mobile testing via proxy)
  // Include multiple format variants — Next.js version history varies on the expected format
  allowedDevOrigins: ['10.0.0.8', '10.0.0.8:8080', 'https://10.0.0.8:8080', 'localhost', 'localhost:8080'],
  // Static export: only when building for Capacitor native apps.
  ...(isCapacitorBuild ? { output: 'export' } : {}),
  images: {
    unoptimized: true,
  },
  // Ensure trailing slashes for better routing
  trailingSlash: true,
  // Proxy /api/auth/* to the timehuddle backend so cookies stay same-origin.
  // Rewrites are incompatible with `output: 'export'` (Capacitor builds) —
  // those builds set NEXT_PUBLIC_BETTER_AUTH_URL to the backend URL directly.
  ...(!isCapacitorBuild
    ? {
        async rewrites() {
          const backendUrl =
            process.env.BETTER_AUTH_BACKEND_URL || 'http://localhost:3001';
          return [
            {
              source: '/api/auth/:path*',
              destination: `${backendUrl}/api/auth/:path*`,
            },
            {
              source: '/api/timeharbor/:path*',
              destination: `${backendUrl}/api/timeharbor/:path*`,
            },
            {
              source: '/api/v1/:path*',
              destination: `${backendUrl}/v1/:path*`,
            },
            {
              source: '/api/health',
              destination: `${backendUrl}/api/health`,
            },
            {
              source: '/uploads/:path*',
              destination: `${backendUrl}/uploads/:path*`,
            },
          ];
        },
      }
    : {}),
  // Fix "multiple lockfiles" warning — tell Turbopack the workspace root
  // is this package, not the monorepo root
  turbopack: {
    root: path.resolve(__dirname, '..'),
    // Capacitor-only native plugins aren't available for web/server builds.
    // Alias them to lightweight stubs so Turbopack doesn't fail on resolution.
    resolveAlias: {
      '@capgo/capacitor-native-biometric':
        './timeharbourapp/stubs/capacitor-native-biometric.js',
      '@capacitor-community/secure-storage-plugin':
        './timeharbourapp/stubs/capacitor-native-biometric.js',
    },
  },
  // Prevent webpack from walking up to the monorepo root's node_modules
  // when resolving CSS/PostCSS deps (e.g. tailwindcss). Without this,
  // enhanced-resolve finds /TimeharborApp/package.json and fails to locate
  // tailwindcss there, causing noisy errors on every CSS compile.
  webpack: (config, { isServer }) => {
    config.resolve.modules = [
      path.join(__dirname, 'node_modules'),
      'node_modules',
    ];
    // Capacitor-only native plugins aren't installed for web builds.
    // Mark them as external so webpack doesn't try to resolve them.
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        '@capacitor-community/secure-storage-plugin': false,
      };
    } else {
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : []),
        '@capacitor-community/secure-storage-plugin',
      ];
    }
    return config;
  },
};

export default nextConfig;