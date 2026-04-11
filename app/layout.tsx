import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '@/components/providers/AuthProvider';
import { SWRegistrar } from '@/components/providers/SWRegistrar';

export const metadata: Metadata = {
  title: 'RISE — My Organized Hub for Everything',
  description: 'Your personal operating system. Manage your life, goals, habits, and growth in one place.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: false,
    statusBarStyle: 'black-translucent',
    title: 'RISE',
  },
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/icon-192.png',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

export const viewport: Viewport = {
  themeColor: '#0A0A0A',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body>
        <AuthProvider>
          <SWRegistrar />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
