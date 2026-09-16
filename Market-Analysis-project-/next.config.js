/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  async redirects() {
    return [
      {
        source: '/analysis',
        destination: '/markets/stock',
        permanent: true,
      },
      {
        source: '/test-chart',
        destination: '/',
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;
