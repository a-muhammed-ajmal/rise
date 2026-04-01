'use client';

import { useAuth } from '@/components/providers/AuthProvider';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-surface">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rise to-rise-dark animate-pulse" />
      </div>
    );
  }

  if (!user) return null;

  return <AppLayout>{children}</AppLayout>;
}
