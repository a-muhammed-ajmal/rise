'use client';

import { useState, useEffect } from 'react';
import { toast, type ToastMessage } from '@/lib/toast';

const MAX_TOASTS = 3;

export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const unsubAdd = toast.onToast((newToast) => {
      setToasts((prev) => {
        const next = [...prev, newToast];
        return next.length > MAX_TOASTS ? next.slice(next.length - MAX_TOASTS) : next;
      });
    });

    const unsubDismiss = toast.onDismiss((id) => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    });

    return () => {
      unsubAdd();
      unsubDismiss();
    };
  }, []);

  const dismiss = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return { toasts, dismiss };
}
