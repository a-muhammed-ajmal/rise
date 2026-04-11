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
    // navigateFallback intentionally omitted: this is an SSR app, not an SPA.
    // registerNavigationRoute would serve the fallback page for ALL navigations,
    // breaking server-rendered routes. Network-first is correct for Next.js pages.
  },
});
