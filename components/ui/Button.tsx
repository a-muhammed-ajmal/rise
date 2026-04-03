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
      'inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-150 active:scale-[0.98]',
      variant === 'primary' && 'bg-rise text-[#0A0A0F] hover:bg-rise-dark hover:scale-[1.02] shadow-sm shadow-rise/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rise/60',
      variant === 'secondary' && 'bg-transparent text-rise border border-rise/40 hover:bg-rise/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rise/60',
      variant === 'ghost' && 'text-text-2 hover:bg-white/5 hover:text-rise focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rise/60',
      variant === 'danger' && 'bg-red-500/90 text-white hover:bg-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/60',
      size === 'sm' && 'px-3 py-1.5 text-xs',
      size === 'md' && 'px-4 py-2.5 text-sm',
      size === 'lg' && 'px-6 py-3 text-base',
      className
    )} {...props}>
      {children}
    </button>
  );
}
