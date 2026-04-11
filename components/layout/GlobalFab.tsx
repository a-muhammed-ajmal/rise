'use client';

import {
  Plus,
  CheckSquare,
  UserPlus,
  Briefcase,
  TrendingUp,
  TrendingDown,
  Activity,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const QUICK_ITEMS: {
  label: string;
  icon: typeof Plus;
  color: string;
}[] = [
  { label: 'Action', icon: CheckSquare, color: '#FF6B35' },
  { label: 'Lead', icon: UserPlus, color: '#1E4AFF' },
  { label: 'Deal', icon: Briefcase, color: '#1ABC9C' },
  { label: 'Connection', icon: UserPlus, color: '#FF4F6D' },
  { label: 'Income', icon: TrendingUp, color: '#1ABC9C' },
  { label: 'Expense', icon: TrendingDown, color: '#FF4F6D' },
  { label: 'Rhythm', icon: Activity, color: '#1ABC9C' },
  { label: 'Document', icon: FileText, color: '#8E95A9' },
];

export function QuickCreateSheet({
  open,
  onClose,
  onAction,
}: {
  open: boolean;
  onClose: () => void;
  onAction: (label: string) => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-end justify-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 border-0 cursor-default"
        onClick={onClose}
        aria-label="Close quick create"
      />
      <div className="relative z-10 bg-[#141414] rounded-t-sheet sm:rounded-card w-full sm:max-w-md mx-0 sm:mx-4 sm:mb-24 p-4 pb-safe max-h-[90dvh] overflow-y-auto">
        <div className="flex justify-center mb-4 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-[#2A2A2A]" />
        </div>
        <p className="text-xs text-[#8A8A8A] text-center mb-4 font-medium uppercase tracking-wider">
          Quick Create
        </p>
        <div className="grid grid-cols-2 gap-3">
          {QUICK_ITEMS.map(({ label, icon: Icon, color }) => {
            const enabled = label === 'Action';
            return (
              <button
                key={label}
                type="button"
                disabled={!enabled}
                onClick={() => {
                  if (enabled) onAction(label);
                }}
                className={cn(
                  'flex flex-col items-center gap-1.5 p-3 rounded-card bg-[#1C1C1C] transition-transform',
                  enabled ? 'active:scale-95 hover:bg-[#222]' : 'opacity-50 cursor-not-allowed'
                )}
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: `${color}22` }}
                >
                  <Icon size={18} style={{ color }} />
                </div>
                <span className="text-xs text-[#F0F0F0]">{label}</span>
                {!enabled && (
                  <span className="text-[10px] text-[#8A8A8A] leading-tight">Coming soon</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function GlobalFabButton({
  onClick,
  open,
}: {
  onClick: () => void;
  open: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'fixed z-50 w-14 h-14 bg-[#FF6B35] rounded-full flex items-center justify-center shadow-fab',
        'active:scale-95 transition-transform',
        'bottom-[calc(env(safe-area-inset-bottom)+3.5rem)] right-4',
        'sm:bottom-6 sm:right-6'
      )}
      aria-expanded={open}
      aria-label={open ? 'Close quick create' : 'Open quick create'}
    >
      <Plus
        size={24}
        className={cn('text-white transition-transform duration-200 ease-out', open && 'rotate-45')}
      />
    </button>
  );
}
