'use client';

import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
}

function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'bg-[#1C1C1C] rounded animate-pulse',
        className
      )}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="bg-[#141414] rounded-card p-4 flex flex-col gap-3 border border-[#2A2A2A]">
      <div className="flex items-center gap-3">
        <Skeleton className="w-8 h-8 rounded-full" />
        <div className="flex-1 flex flex-col gap-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
        <Skeleton className="h-6 w-16 rounded-chip" />
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  );
}

export function SkeletonListItem() {
  return (
    <div className="flex items-center gap-3 py-3 px-4 border-b border-[#2A2A2A]">
      <Skeleton className="w-5 h-5 rounded" />
      <div className="flex-1 flex flex-col gap-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/3" />
      </div>
      <Skeleton className="h-5 w-5 rounded-full" />
    </div>
  );
}

export function SkeletonStats() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="bg-[#141414] rounded-card p-4 border border-[#2A2A2A]">
          <Skeleton className="h-3 w-1/2 mb-2" />
          <Skeleton className="h-7 w-3/4" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonHeader() {
  return (
    <div className="flex flex-col gap-2 px-4 pb-4">
      <Skeleton className="h-7 w-1/2" />
      <Skeleton className="h-4 w-1/3" />
    </div>
  );
}
