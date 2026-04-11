const withPWA = require('next-pwa');

module.exports = withPWA({
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
    ],
  },
  pwa: {
    dest: 'public',
    disable: process.env.NODE_ENV === 'development',
    register: true,
    scope: '/',
    skipWaiting: true,
    clientsClaim: true,
    cleanupOutdatedCaches: true,
    // Workbox v4 (bundled with next-pwa 2.x): single fallback for failed navigations
    navigateFallback: '/offline.html',
  },
});
