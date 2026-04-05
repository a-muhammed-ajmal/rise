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
      'inline-flex items-center justify-center gap-2 font-semibold rounded-lg transition-all duration-150 active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none',
      variant === 'primary' && 'bg-gradient-to-b from-rise to-rise-dark text-[#0A0A0F] shadow-md shadow-rise/20 hover:shadow-lg hover:shadow-rise/30 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rise/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
      variant === 'secondary' && 'bg-white/[0.06] text-text border border-white/[0.08] hover:bg-white/[0.1] hover:border-white/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rise/50',
      variant === 'ghost' && 'text-text-2 hover:bg-white/[0.06] hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rise/50',
      variant === 'danger' && 'bg-red-500/15 text-red-400 border border-red-500/20 hover:bg-red-500/25 hover:border-red-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50',
      size === 'sm' && 'px-3 py-1.5 text-xs',
      size === 'md' && 'px-4 py-2.5 text-sm',
      size === 'lg' && 'px-6 py-3 text-sm',
      className
    )} {...props}>
      {children}
    </button>
  );
}
