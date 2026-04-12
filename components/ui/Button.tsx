'use client';

import { type ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { LoadingSpinner } from './LoadingSpinner';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      fullWidth = false,
      className,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const base =
      'inline-flex items-center justify-center gap-2 font-semibold rounded-button transition-all active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed select-none';

    const variants = {
      primary: 'bg-[#FF6B35] text-white hover:bg-[#E55A25] active:bg-[#E55A25]',
      secondary: 'border border-[#E5E5EA] text-[#1C1C1E] bg-white hover:bg-[#F5F5F5]',
      ghost: 'text-[#1C1C1E] hover:bg-[#F2F2F7]',
      danger: 'bg-[#FF4F6D] text-white hover:bg-[#e0405e]',
    };

    const sizes = {
      sm: 'h-8 px-3 text-sm',
      md: 'h-11 px-5 text-sm',
      lg: 'h-14 px-6 text-base',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          base,
          variants[variant],
          sizes[size],
          fullWidth && 'w-full',
          className
        )}
        {...props}
      >
        {loading ? <LoadingSpinner size="sm" /> : children}
      </button>
    );
  }
);

Button.displayName = 'Button';
