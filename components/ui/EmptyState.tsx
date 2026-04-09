'use client';

import { type LucideIcon } from 'lucide-react';
import { Button } from './Button';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon: Icon,
  title,
  subtitle,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6 gap-4">
      <div className="w-20 h-20 rounded-full bg-[#1C1C1C] flex items-center justify-center">
        <Icon size={36} className="text-[#505050]" />
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-semibold text-[#F0F0F0]">{title}</h3>
        <p className="text-sm text-[#8A8A8A] max-w-xs">{subtitle}</p>
      </div>
      {actionLabel && onAction && (
        <Button variant="primary" size="md" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
