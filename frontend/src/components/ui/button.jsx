import React, { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

const variantStyles = {
  default: 'bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800 shadow-sm shadow-indigo-200 dark:shadow-none',
  secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-200 active:bg-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700',
  destructive: 'bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800 shadow-sm shadow-rose-200 dark:shadow-none',
  outline: 'border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800',
  ghost: 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800',
  link: 'text-indigo-600 dark:text-indigo-400 underline-offset-4 hover:underline p-0 h-auto',
};

const sizeStyles = {
  default: 'h-10 px-4 py-2 text-sm',
  sm: 'h-8 px-3 text-xs',
  lg: 'h-12 px-6 text-base font-bold',
  icon: 'h-10 w-10 p-0',
};

export const Button = forwardRef(({
  className,
  variant = 'default',
  size = 'default',
  isLoading = false,
  disabled = false,
  children,
  ...props
}, ref) => {
  return (
    <button
      ref={ref}
      disabled={disabled || isLoading}
      className={cn(
        'inline-flex items-center justify-center font-bold rounded-xl transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer',
        variantStyles[variant] || variantStyles.default,
        sizeStyles[size] || sizeStyles.default,
        className
      )}
      {...props}
    >
      {isLoading && (
        <Loader2 className="mr-2 h-4 w-4 animate-spin shrink-0" />
      )}
      {children}
    </button>
  );
});

Button.displayName = 'Button';
