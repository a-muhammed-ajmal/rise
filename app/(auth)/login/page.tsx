'use client';

import { useAuth } from '@/components/providers/AuthProvider';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function LoginPage() {
  const { user, loading, signInWithGoogle } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) router.replace('/');
  }, [user, router]);

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-surface">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rise to-rise-dark animate-pulse" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 relative overflow-hidden">
      {/* Subtle radial glow behind logo */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-rise/[0.04] rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-sm space-y-10 relative z-10">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-rise to-rise-dark flex items-center justify-center text-white text-2xl font-bold mx-auto shadow-xl shadow-rise/20 ring-1 ring-white/10">
            R
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text tracking-tight">RISE</h1>
            <p className="text-text-2 text-[13px] mt-1">My Organized Hub for Everything</p>
          </div>
        </div>

        <button onClick={signInWithGoogle}
          className="w-full flex items-center justify-center gap-3 px-5 py-3.5 bg-white/[0.04] border border-white/[0.08] rounded-xl hover:bg-white/[0.07] hover:border-white/[0.12] transition-all duration-200 text-text text-[14px] font-semibold active:scale-[0.98]">
          <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
          Sign in with Google
        </button>

        <p className="text-center text-[11px] text-text-3">
          Your personal life management hub
        </p>
      </div>
    </div>
  );
}
