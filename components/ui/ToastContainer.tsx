'use client';

import { useEffect } from 'react';
import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/useToast';
import type { ToastType } from '@/lib/toast';

const TOAST_CONFIG: Record<
  ToastType,
  { icon: typeof CheckCircle; color: string; bg: string; border: string }
> = {
  success: { icon: CheckCircle, color: '#1ABC9C', bg: '#F0FDF4', border: '#D1FAE5' },
  error: { icon: XCircle, color: '#FF4F6D', bg: '#FFF1F2', border: '#FFE4E8' },
  info: { icon: Info, color: '#007AFF', bg: '#EFF6FF', border: '#DBEAFE' },
  warning: { icon: AlertTriangle, color: '#F59E0B', bg: '#FFFBEB', border: '#FEF3C7' },
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
  const { icon: Icon, color, bg, border } = TOAST_CONFIG[type];

  useEffect(() => {
    const timer = setTimeout(() => onDismiss(id), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [id, onDismiss]);

  return (
    <div
      className={cn(
        'flex items-start gap-3 px-4 py-3 rounded-card shadow-card min-w-[280px] max-w-sm border',
        'animate-slide-up'
      )}
      style={{ backgroundColor: bg, borderColor: border }}
    >
      <Icon size={18} style={{ color }} className="flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm text-[#1C1C1E] leading-snug">{message}</p>
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
        className="text-[#AEAEB2] hover:text-[#6C6C70] flex-shrink-0"
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
