import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable webpack polling for Windows Docker hot reload
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
        ignored: ['**/node_modules', '**/.git', '**/.next'],
      }
    }
    return config
  },
};

export default nextConfig;
