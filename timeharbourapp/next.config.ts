import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable static export for Capacitor
  output: 'export',
  images: {
    unoptimized: true,
  },
  // Ensure trailing slashes for better routing
  trailingSlash: true,
};

export default nextConfig;