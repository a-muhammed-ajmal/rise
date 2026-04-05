import { cn } from '@/lib/utils';
import { InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function Input({ label, className, ...props }: InputProps) {
  return (
    <div className="space-y-1.5">
      {label && <label className="text-[13px] font-medium text-text-2">{label}</label>}
      <input className={cn(
        'w-full px-3.5 py-2.5 rounded-lg border border-white/[0.08] bg-white/[0.03] text-text text-sm',
        'focus:outline-none focus:ring-2 focus:ring-rise/25 focus:border-rise/40 transition-all duration-150',
        'placeholder:text-text-3 hover:border-white/[0.12]',
        className
      )} {...props} />
    </div>
  );
}

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

export function TextArea({ label, className, ...props }: TextAreaProps) {
  return (
    <div className="space-y-1.5">
      {label && <label className="text-[13px] font-medium text-text-2">{label}</label>}
      <textarea className={cn(
        'w-full px-3.5 py-2.5 rounded-lg border border-white/[0.08] bg-white/[0.03] text-text text-sm min-h-[80px] resize-none',
        'focus:outline-none focus:ring-2 focus:ring-rise/25 focus:border-rise/40 transition-all duration-150',
        'placeholder:text-text-3 hover:border-white/[0.12]',
        className
      )} {...props} />
    </div>
  );
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
}

export function Select({ label, options, className, ...props }: SelectProps) {
  return (
    <div className="space-y-1.5">
      {label && <label className="text-[13px] font-medium text-text-2">{label}</label>}
      <select className={cn(
        'w-full px-3.5 py-2.5 rounded-lg border border-white/[0.08] bg-white/[0.03] text-text text-sm appearance-none',
        'focus:outline-none focus:ring-2 focus:ring-rise/25 focus:border-rise/40 transition-all duration-150',
        'hover:border-white/[0.12]',
        className
      )} {...props}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}
