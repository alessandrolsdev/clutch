import type { NextConfig } from 'next';

function resolveWatchPollingInterval(): number {
  const rawValue = process.env['WATCHPACK_POLLING_INTERVAL'];
  const parsedValue = rawValue ? Number(rawValue) : Number.NaN;

  if (Number.isFinite(parsedValue) && parsedValue >= 200) {
    return Math.floor(parsedValue);
  }

  return 1000;
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'images.igdb.com',
      },
    ],
  },
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        // Docker Desktop on Windows/WSL is more stable with polling plus an explicit ignore list.
        poll: resolveWatchPollingInterval(),
        aggregateTimeout: 300,
        ignored: /(^|[\\/])(\.git|\.next|node_modules)([\\/]|$)/,
      };
    }

    return config;
  },
};

export default nextConfig;
