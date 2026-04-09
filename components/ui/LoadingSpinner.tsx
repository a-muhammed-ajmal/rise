'use client';

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
    <div className="fixed inset-0 bg-[#0A0A0A] flex items-center justify-center z-50">
      <div className="flex flex-col items-center gap-4">
        <span className="text-3xl font-bold text-[#FF6B35] animate-pulse tracking-widest">
          RISE
        </span>
        <LoadingSpinner size="md" className="text-[#FF6B35]" />
      </div>
    </div>
  );
}
