import React, { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

const variantStyles = {
  default: 'bg-zinc-900 text-white hover:bg-zinc-800 active:bg-zinc-950 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:active:bg-white shadow-xs border border-transparent',
  primary: 'bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800 shadow-xs border border-transparent',
  secondary: 'bg-zinc-100 text-zinc-800 hover:bg-zinc-200/80 active:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700 border border-zinc-200/60 dark:border-zinc-700/60',
  destructive: 'bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800 shadow-xs border border-transparent',
  outline: 'border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800/80 shadow-2xs',
  ghost: 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800/80',
  link: 'text-zinc-900 dark:text-zinc-100 underline-offset-4 hover:underline p-0 h-auto font-medium',
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
        'inline-flex items-center justify-center font-semibold rounded-lg transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-600 disabled:pointer-events-none disabled:opacity-40 select-none cursor-pointer',
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
