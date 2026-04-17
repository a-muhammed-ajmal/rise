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
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet / Modal */}
      <div
        ref={sheetRef}
        className={cn(
          'relative z-10 bg-white w-full max-h-[92dvh] flex flex-col',
          'animate-slide-up border border-[#E5E5EA]',
          forceModal
            ? 'rounded-card max-w-lg mx-4 shadow-card'
            : 'rounded-t-sheet sm:rounded-card sm:max-w-lg sm:mx-4 shadow-sheet sm:shadow-card',
          className
        )}
      >
        {/* Drag handle (mobile only) */}
        {!forceModal && (
          <div className="flex justify-center pt-3 pb-1 sm:hidden">
            <div className="w-10 h-1 rounded-full bg-[#E5E5EA]" />
          </div>
        )}

        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5E5EA]">
            <h2 className="text-base font-semibold text-[#1C1C1E]">{title}</h2>
            <button
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[#F2F2F7] text-[#6C6C70] -mr-1"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="px-4 py-4 border-t border-[#E5E5EA] pb-safe">{footer}</div>
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
            className="flex-1 h-11 rounded-button border border-[#E5E5EA] text-sm text-[#1C1C1E] hover:bg-[#F5F5F5] transition-colors"
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
      <p className="text-sm text-[#6C6C70] leading-relaxed">{message}</p>
    </Modal>
  );
}
