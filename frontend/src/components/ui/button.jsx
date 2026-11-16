import React, { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

const variantStyles = {
  default: 'bg-slate-900 text-white hover:bg-slate-800 active:bg-slate-950 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 dark:active:bg-white shadow-xs border border-transparent',
  primary: 'bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800 shadow-xs border border-transparent',
  secondary: 'bg-slate-100 text-slate-800 hover:bg-slate-200/80 active:bg-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 border border-slate-200/60 dark:border-slate-700/60',
  destructive: 'bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800 shadow-xs border border-transparent',
  outline: 'border border-slate-300 bg-white hover:bg-slate-50/80 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 shadow-2xs',
  ghost: 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800/80',
  link: 'text-slate-900 dark:text-slate-100 underline-offset-4 hover:underline p-0 h-auto font-medium',
};

const sizeStyles = {
  default: 'h-9 px-3.5 py-1.5 text-xs tracking-tight',
  xs: 'h-7 px-2.5 text-[11px] tracking-tight',
  sm: 'h-8 px-3 text-xs tracking-tight',
  lg: 'h-10 px-5 text-sm font-semibold tracking-tight',
  icon: 'h-9 w-9 p-0',
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
        'inline-flex items-center justify-center font-semibold rounded-lg transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 dark:focus-visible:ring-slate-600 disabled:pointer-events-none disabled:opacity-40 select-none cursor-pointer',
        variantStyles[variant] || variantStyles.default,
        sizeStyles[size] || sizeStyles.default,
        className
      )}
      {...props}
    >
      {isLoading && (
        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin shrink-0" />
      )}
      {children}
    </button>
  );
});

Button.displayName = 'Button';
