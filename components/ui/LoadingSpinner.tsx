'use client';

import Image from 'next/image';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function LoadingSpinner({ size = 'md', className }: LoadingSpinnerProps) {
  const sizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' };
  return (
    <span
      className={cn(
        'inline-block rounded-full border-2 border-current border-t-transparent animate-spin',
        sizes[size],
        className
      )}
      aria-label="Loading"
    />
  );
}

export function FullPageLoader() {
  return (
    <div
      className="fixed inset-0 bg-[#0A0A0A] flex flex-col items-center justify-center z-50 gap-6"
      role="status"
      aria-live="polite"
    >
      <div className="w-24 h-24 sm:w-32 sm:h-32 animate-logo-pulse-glow">
        <Image
          src="/icons/icon-maskable-912.png"
          alt="RISE"
          width={128}
          height={128}
          className="w-full h-full"
          priority
        />
      </div>
      <span
        className="text-4xl font-bold text-[#FF9933] tracking-widest animate-pulse-glow"
        aria-hidden
      >
        RISE
      </span>
      <span className="sr-only">Loading</span>
    </div>
  );
}
