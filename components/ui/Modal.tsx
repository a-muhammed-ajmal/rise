'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  /** Force modal style even on mobile */
  forceModal?: boolean;
}

/**
 * On mobile: bottom sheet (slides up from bottom).
 * On desktop: centered modal dialog.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  className,
  forceModal = false,
}: ModalProps) {
  const sheetRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Prevent body scroll while open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet / Modal */}
      <div
        ref={sheetRef}
        className={cn(
          'relative z-10 bg-[#141414] w-full max-h-[92dvh] flex flex-col',
          'animate-slide-up',
          forceModal
            ? 'rounded-card max-w-lg mx-4'
            : 'rounded-t-sheet sm:rounded-card sm:max-w-lg sm:mx-4',
          className
        )}
      >
        {/* Drag handle (mobile only) */}
        {!forceModal && (
          <div className="flex justify-center pt-3 pb-1 sm:hidden">
            <div className="w-10 h-1 rounded-full bg-[#2A2A2A]" />
          </div>
        )}

        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#2A2A2A]">
            <h2 className="text-base font-semibold text-[#F0F0F0]">{title}</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#1C1C1C] text-[#8A8A8A]"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="px-4 py-4 border-t border-[#2A2A2A] pb-safe">{footer}</div>
        )}
      </div>
    </div>
  );
}

interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  confirmVariant?: 'danger' | 'primary';
  loading?: boolean;
}

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  confirmVariant = 'danger',
  loading = false,
}: ConfirmModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      forceModal
      footer={
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 h-11 rounded-button border border-[#2A2A2A] text-sm text-[#F0F0F0] hover:bg-[#1C1C1C] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              'flex-1 h-11 rounded-button text-sm font-semibold text-white transition-colors disabled:opacity-50',
              confirmVariant === 'danger' ? 'bg-[#FF4F6D]' : 'bg-[#FF6B35]'
            )}
          >
            {loading ? '...' : confirmLabel}
          </button>
        </div>
      }
    >
      <p className="text-sm text-[#8A8A8A] leading-relaxed">{message}</p>
    </Modal>
  );
}
