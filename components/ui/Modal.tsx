'use client';

import { ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

// Module-level counter tracks how many modals are currently open.
// - Locking only happens when the first modal opens (0 → 1).
// - Unlocking only happens when the last modal closes (1 → 0).
// This prevents a second modal closing from unlocking the body while
// a first modal is still open, and guarantees cleanup on unmount.
let openModalCount = 0;

function acquireScrollLock() {
  if (openModalCount === 0) document.body.style.overflow = 'hidden';
  openModalCount++;
}

function releaseScrollLock() {
  openModalCount = Math.max(0, openModalCount - 1);
  if (openModalCount === 0) document.body.style.overflow = '';
}

export default function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    acquireScrollLock();
    // Cleanup runs both when `open` flips to false AND when the component
    // unmounts while still open — either way the lock count is decremented.
    return () => releaseScrollLock();
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      {/* Desktop: centered modal. Mobile: bottom sheet */}
      <div className={cn(
        'absolute bg-surface-2 overflow-hidden flex flex-col',
        'border border-white/[0.06]',
        // Mobile: bottom sheet
        'bottom-0 left-0 right-0 max-h-[90dvh] rounded-t-2xl animate-slide-up shadow-sheet',
        // Desktop: centered modal
        'lg:bottom-auto lg:top-1/2 lg:left-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rounded-xl lg:animate-scale-in lg:shadow-2xl',
        size === 'sm' && 'lg:w-[400px] lg:max-h-[70vh]',
        size === 'md' && 'lg:w-[520px] lg:max-h-[80vh]',
        size === 'lg' && 'lg:w-[680px] lg:max-h-[85vh]',
      )}>
        {/* Handle bar for mobile */}
        <div className="lg:hidden flex justify-center pt-3 pb-1">
          <div className="w-8 h-1 rounded-full bg-white/10" />
        </div>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
          <h2 className="font-semibold text-[15px] text-text">{title}</h2>
          <button onClick={onClose} className="text-text-3 hover:text-text transition-colors p-1.5 rounded-lg hover:bg-white/[0.06]">
            <X size={18} />
          </button>
        </div>
        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {children}
        </div>
      </div>
    </div>
  );
}
