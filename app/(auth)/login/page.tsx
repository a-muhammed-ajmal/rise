'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { getUserMeta } from '@/lib/firestore';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export default function LoginPage() {
  const { user, signInWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Redirect if already logged in
  useEffect(() => {
    if (!user) return;
    (async () => {
      const meta = await getUserMeta(user.uid);
      if (!meta?.onboardingComplete) {
        router.replace('/onboarding');
      } else {
        router.replace('/');
      }
    })();
  }, [user, router]);

  const handleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sign in failed. Please try again.';
      setError(msg);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh bg-[#0A0A0A] flex items-center justify-center px-6">
      <div className="w-full max-w-sm flex flex-col items-center gap-8">
        {/* Logo */}
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-5xl font-bold text-[#FF6B35] tracking-widest animate-pulse-glow">
            RISE
          </h1>
          <p className="text-sm text-[#8A8A8A] text-center">
            My Organized Hub for Everything
          </p>
        </div>

        {/* Sign In Card */}
        <div className="w-full bg-[#141414] rounded-card p-6 border border-[#2A2A2A] flex flex-col gap-4">
          <div className="text-center">
            <h2 className="text-base font-semibold text-[#F0F0F0]">Welcome back</h2>
            <p className="text-sm text-[#8A8A8A] mt-1">Sign in to continue your journey</p>
          </div>

          {/* Google Sign In */}
          <button
            onClick={handleSignIn}
            disabled={loading}
            className="w-full h-12 bg-white text-[#1a1a1a] rounded-button flex items-center justify-center gap-3 font-semibold text-sm hover:bg-gray-100 active:bg-gray-200 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <LoadingSpinner size="sm" className="text-[#1a1a1a]" />
            ) : (
              <>
                {/* Google SVG icon */}
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                  <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
                  <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                  <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                </svg>
                Sign in with Google
              </>
            )}
          </button>

          {error && (
            <p className="text-xs text-[#FF4F6D] text-center">{error}</p>
          )}
        </div>

        {/* Footer note */}
        <p className="text-xs text-[#505050] text-center">
          Single user · UAE · Your data stays yours
        </p>
      </div>
    </div>
  );
}
