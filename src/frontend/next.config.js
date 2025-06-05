/** @type {import('next').NextConfig} */
const { i18n } = require('./next-i18next.config');

const nextConfig = {
  reactStrictMode: true,
  i18n,
  images: {
    domains: [
      'res.cloudinary.com',
      'images.unsplash.com',
      'example-maps.com'
    ],
  },
  env: {
    MAPBOX_TOKEN: process.env.MAPBOX_TOKEN,
    API_URL: process.env.API_URL,
    NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV || 'development',
    NEXT_PUBLIC_AI_API_URL: process.env.NEXT_PUBLIC_AI_API_URL || 'http://localhost:8000',
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.API_URL}/:path*`, // Proxy to Backend
      },
      {
        source: '/ai-api/:path*',
        destination: `${process.env.NEXT_PUBLIC_AI_API_URL}/:path*`, // Proxy to AI API
      },
    ];
  },
};

module.exports = nextConfig;