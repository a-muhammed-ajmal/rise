'use client';

import React, {
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
  forwardRef,
} from 'react';
import { cn } from '@/lib/utils';

interface BaseFieldProps {
  label?: string;
  error?: string;
  helper?: string;
}

export interface InputProps
  extends InputHTMLAttributes<HTMLInputElement>,
    BaseFieldProps {}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helper, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-[#1C1C1E]">
            {label}
            {props.required && <span className="text-[#FF4F6D] ml-0.5">*</span>}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'w-full bg-[#F5F5F5] border rounded-input px-3 py-2.5 text-sm text-[#1C1C1E] placeholder-[#AEAEB2] outline-none transition-colors',
            'focus:border-[#FF6B35] focus:bg-white',
            error ? 'border-[#FF4F6D]' : 'border-[#E5E5EA]',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-[#FF4F6D]">{error}</p>}
        {helper && !error && <p className="text-xs text-[#6C6C70]">{helper}</p>}
      </div>
    );
  }
);
Input.displayName = 'Input';

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement>,
    BaseFieldProps {}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, helper, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-[#1C1C1E]">
            {label}
            {props.required && <span className="text-[#FF4F6D] ml-0.5">*</span>}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          className={cn(
            'w-full bg-[#F5F5F5] border rounded-input px-3 py-2.5 text-sm text-[#1C1C1E] placeholder-[#AEAEB2] outline-none transition-colors resize-none',
            'focus:border-[#FF6B35] focus:bg-white',
            error ? 'border-[#FF4F6D]' : 'border-[#E5E5EA]',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-[#FF4F6D]">{error}</p>}
        {helper && !error && <p className="text-xs text-[#6C6C70]">{helper}</p>}
      </div>
    );
  }
);
Textarea.displayName = 'Textarea';

export interface SelectProps
  extends InputHTMLAttributes<HTMLSelectElement>,
    BaseFieldProps {
  options: Array<{ value: string; label: string }>;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, helper, className, id, options, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-[#1C1C1E]">
            {label}
            {props.required && <span className="text-[#FF4F6D] ml-0.5">*</span>}
          </label>
        )}
        <select
          ref={ref}
          id={inputId}
          className={cn(
            'w-full bg-[#F5F5F5] border rounded-input px-3 py-2.5 text-sm text-[#1C1C1E] outline-none transition-colors appearance-none',
            'focus:border-[#FF6B35] focus:bg-white',
            error ? 'border-[#FF4F6D]' : 'border-[#E5E5EA]',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            className
          )}
          {...(props as unknown as React.SelectHTMLAttributes<HTMLSelectElement>)}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && <p className="text-xs text-[#FF4F6D]">{error}</p>}
        {helper && !error && <p className="text-xs text-[#6C6C70]">{helper}</p>}
      </div>
    );
  }
);
Select.displayName = 'Select';
