import type { NextConfig } from 'next';
import path from 'path';
import withSerwistInit from '@serwist/next';

const withSerwist = withSerwistInit({
  swSrc: 'app/sw.ts',
  swDest: 'public/sw.js',
});

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname),
  serverExternalPackages: [
    'firebase',
    'firebase/app',
    'firebase/auth',
    'firebase/firestore',
    'firebase/storage',
    '@google/genai',
    'google-auth-library',
    'ecdsa-sig-formatter',
    'extend',
  ],
};

export default withSerwist(nextConfig);
