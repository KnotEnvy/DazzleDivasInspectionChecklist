/** @type {import('next').NextConfig} */
const nextConfig = {
  // Configure Next.js for static file serving
  experimental: {
    serverComponentsExternalPackages: ['sharp'],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3001',
        pathname: '/uploads/**',
      },
    ],
    domains: ['localhost'],
  },
  // Configure webpack to handle binary files
  webpack: (config) => {
    config.module.rules.push({
      test: /\.(png|jpe?g|gif|webp)$/i,
      type: 'asset/resource',
    });
    return config;
  },
};

module.exports = nextConfig;