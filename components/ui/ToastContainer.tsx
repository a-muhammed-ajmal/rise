'use client';

import { useState, useEffect, useCallback } from 'react';
import { _registerToastHandler } from '@/lib/toast';
import { cn } from '@/lib/utils';

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
            'px-4 py-3 rounded-xl shadow-lg text-sm font-medium animate-slide-up',
            t.type === 'success' ? 'bg-rise text-[#0A0A0F]' : 'bg-red-500 text-white',
          )}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
