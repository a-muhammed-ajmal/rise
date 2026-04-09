'use client';

import { cn } from '@/lib/utils';
import { PRIORITY_COLORS, PRIORITY_LABELS } from '@/lib/constants';
import type { Priority } from '@/lib/types';

interface BadgeProps {
  label: string;
  color?: string;
  className?: string;
}

export function Badge({ label, color, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-chip text-xs font-medium',
        className
      )}
      style={
        color
          ? {
              backgroundColor: color + '22',
              color: color,
              border: `1px solid ${color}33`,
            }
          : {
              backgroundColor: '#2A2A2A',
              color: '#8A8A8A',
            }
      }
    >
      {label}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const color = PRIORITY_COLORS[priority];
  const label = `${priority} · ${PRIORITY_LABELS[priority]}`;
  return <Badge label={label} color={color} />;
}

export function PriorityDot({ priority }: { priority: Priority }) {
  const color = PRIORITY_COLORS[priority];
  return (
    <span
      className="inline-block w-2 h-2 rounded-full flex-shrink-0"
      style={{ backgroundColor: color }}
      title={`Priority ${priority}`}
    />
  );
}

export function StatusBadge({
  status,
  colorMap,
}: {
  status: string;
  colorMap: Record<string, string>;
}) {
  const color = colorMap[status] ?? '#8A8A8A';
  return <Badge label={status} color={color} />;
}
