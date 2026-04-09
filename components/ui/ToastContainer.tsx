'use client';

import { useEffect } from 'react';
import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/useToast';
import type { ToastType } from '@/lib/toast';

const TOAST_CONFIG: Record<
  ToastType,
  { icon: typeof CheckCircle; color: string; bg: string }
> = {
  success: { icon: CheckCircle, color: '#1ABC9C', bg: '#1ABC9C22' },
  error: { icon: XCircle, color: '#FF4F6D', bg: '#FF4F6D22' },
  info: { icon: Info, color: '#1E4AFF', bg: '#1E4AFF22' },
  warning: { icon: AlertTriangle, color: '#FFD700', bg: '#FFD70022' },
};

const AUTO_DISMISS_MS = 3500;

function ToastItem({
  id,
  type,
  message,
  action,
  onDismiss,
}: {
  id: string;
  type: ToastType;
  message: string;
  action?: { label: string; onClick: () => void };
  onDismiss: (id: string) => void;
}) {
  const { icon: Icon, color, bg } = TOAST_CONFIG[type];

  useEffect(() => {
    const timer = setTimeout(() => onDismiss(id), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [id, onDismiss]);

  return (
    <div
      className={cn(
        'flex items-start gap-3 px-4 py-3 rounded-card shadow-card border border-[#2A2A2A] min-w-[280px] max-w-sm',
        'animate-slide-up'
      )}
      style={{ backgroundColor: bg }}
    >
      <Icon size={18} style={{ color }} className="flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm text-[#F0F0F0] leading-snug">{message}</p>
        {action && (
          <button
            onClick={() => {
              action.onClick();
              onDismiss(id);
            }}
            className="mt-1 text-xs font-semibold"
            style={{ color }}
          >
            {action.label}
          </button>
        )}
      </div>
      <button
        onClick={() => onDismiss(id)}
        className="text-[#8A8A8A] hover:text-[#F0F0F0] flex-shrink-0"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export function ToastContainer() {
  const { toasts, dismiss } = useToast();

  return (
    <div
      className="fixed z-[100] flex flex-col gap-2 pointer-events-none
        bottom-[72px] left-1/2 -translate-x-1/2 items-center
        sm:bottom-4 sm:right-4 sm:left-auto sm:translate-x-0 sm:items-end"
    >
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem {...t} onDismiss={dismiss} />
        </div>
      ))}
    </div>
  );
}
