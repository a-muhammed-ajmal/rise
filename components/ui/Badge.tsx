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
              backgroundColor: color + '18',
              color: color,
              border: `1px solid ${color}30`,
            }
          : {
              backgroundColor: '#F2F2F7',
              color: '#6C6C70',
              border: '1px solid #E5E5EA',
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
  const color = colorMap[status] ?? '#6C6C70';
  return <Badge label={status} color={color} />;
}
