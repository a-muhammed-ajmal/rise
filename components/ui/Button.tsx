import { cn } from '@/lib/utils';
import { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
}

export default function Button({ variant = 'primary', size = 'md', className, children, ...props }: ButtonProps) {
  return (
    <button className={cn(
      'inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all active:scale-[0.97]',
      variant === 'primary' && 'bg-rise text-white hover:bg-rise-dark shadow-sm',
      variant === 'secondary' && 'bg-surface-2 text-text border border-border hover:bg-surface-3',
      variant === 'ghost' && 'text-text-2 hover:bg-surface-2',
      variant === 'danger' && 'bg-red-500 text-white hover:bg-red-600',
      size === 'sm' && 'px-3 py-1.5 text-xs',
      size === 'md' && 'px-4 py-2.5 text-sm',
      size === 'lg' && 'px-6 py-3 text-base',
      className
    )} {...props}>
      {children}
    </button>
  );
}
