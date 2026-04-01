import type { NextConfig } from 'next';
import path from 'path';

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

export default nextConfig;
