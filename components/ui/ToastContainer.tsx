'use client';

import { useState, useEffect, useCallback } from 'react';
import { _registerToastHandler } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { CheckCircle2, XCircle } from 'lucide-react';

interface ToastItem {
  id: number;
  message: string;
  type: 'success' | 'error';
}

let _id = 0;

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    const id = ++_id;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }, []);

  useEffect(() => {
    _registerToastHandler(addToast);
  }, [addToast]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-24 left-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none lg:bottom-6 lg:left-auto lg:right-6 lg:max-w-sm">
      {toasts.map(t => (
        <div
          key={t.id}
          className={cn(
            'flex items-center gap-2.5 px-4 py-3 rounded-lg shadow-xl text-sm font-medium animate-slide-up border',
            t.type === 'success'
              ? 'bg-surface-3 text-emerald-400 border-emerald-500/20'
              : 'bg-surface-3 text-red-400 border-red-500/20',
          )}
        >
          {t.type === 'success' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
          {t.message}
        </div>
      ))}
    </div>
  );
}
