import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { cn } from '../../lib/utils';

const ToastContext = createContext(null);

const iconMap = {
  success: <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />,
  destructive: <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />,
  warning: <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />,
  default: <Info className="w-5 h-5 text-indigo-500 shrink-0" />,
};

const borderMap = {
  success: 'border-emerald-200 dark:border-emerald-900 bg-white dark:bg-slate-900',
  destructive: 'border-rose-200 dark:border-rose-900 bg-white dark:bg-slate-900',
  warning: 'border-amber-200 dark:border-amber-900 bg-white dark:bg-slate-900',
  default: 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900',
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback(({ title, description, variant = 'default', duration = 4000 }) => {
    const id = Math.random().toString(36).slice(2, 9);
    const newToast = { id, title, description, variant, duration };

    setToasts((prev) => [...prev, newToast]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast: addToast, removeToast }}>
      {children}
      {/* Toast Viewport Container */}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none p-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto flex items-start gap-3 p-4 rounded-2xl shadow-xl border animate-in slide-in-from-bottom-5 duration-200 select-none',
              borderMap[t.variant] || borderMap.default
            )}
          >
            {iconMap[t.variant] || iconMap.default}
            <div className="flex-1 min-w-0">
              {t.title && <h5 className="text-xs font-bold text-slate-900 dark:text-slate-100">{t.title}</h5>}
              {t.description && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                  {t.description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => removeToast(t.id)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded-lg transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    return {
      toast: (msg) => console.log('[Toast Notice]', msg),
    };
  }
  return context;
}
