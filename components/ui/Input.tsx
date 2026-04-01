import { cn } from '@/lib/utils';
import { InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function Input({ label, className, ...props }: InputProps) {
  return (
    <div className="space-y-1.5">
      {label && <label className="text-sm font-medium text-text-2">{label}</label>}
      <input className={cn(
        'w-full px-4 py-3 rounded-xl border border-border bg-surface-2 text-text text-sm',
        'focus:outline-none focus:ring-2 focus:ring-rise/30 focus:border-rise transition-colors',
        'placeholder:text-text-3',
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
      {label && <label className="text-sm font-medium text-text-2">{label}</label>}
      <textarea className={cn(
        'w-full px-4 py-3 rounded-xl border border-border bg-surface-2 text-text text-sm min-h-[80px] resize-none',
        'focus:outline-none focus:ring-2 focus:ring-rise/30 focus:border-rise transition-colors',
        'placeholder:text-text-3',
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
      {label && <label className="text-sm font-medium text-text-2">{label}</label>}
      <select className={cn(
        'w-full px-4 py-3 rounded-xl border border-border bg-surface-2 text-text text-sm appearance-none',
        'focus:outline-none focus:ring-2 focus:ring-rise/30 focus:border-rise transition-colors',
        className
      )} {...props}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}
