'use client';

import { useState, useEffect } from 'react';
import { getUserMeta } from '@/lib/firestore';
import { useAuth } from './useAuth';

export function useOnboarding() {
  const { user } = useAuth();
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    getUserMeta(user.uid).then((meta) => {
      setOnboardingComplete(meta?.onboardingComplete ?? false);
      setLoading(false);
    });
  }, [user]);

  return { onboardingComplete, loading };
}
