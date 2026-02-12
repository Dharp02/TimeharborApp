import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Remove 'export' to support dynamic routes for member pages
  // Capacitor will work with the standard build output
  images: {
    unoptimized: true,
  },
  // Ensure trailing slashes for better routing
  trailingSlash: true,
};

export default nextConfig;