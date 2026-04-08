'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { cn } from '@/lib/utils/cn';

type ToastTone = 'success' | 'error' | 'info';

type Toast = {
  id: number;
  title: string;
  description?: string;
  tone: ToastTone;
};

type ToastInput = {
  title: string;
  description?: string;
  tone?: ToastTone;
};

type ToastContextValue = {
  showToast: (input: ToastInput) => void;
};

const toastToneClassName: Record<ToastTone, string> = {
  success: 'border-status-online/35 bg-[rgba(16,185,129,0.12)]',
  error: 'border-status-afk/35 bg-[rgba(245,158,11,0.12)]',
  info: 'border-accent-cyan/35 bg-[rgba(6,182,212,0.12)]',
};

const ToastContext = createContext<ToastContextValue | null>(null);

type ToastProviderProps = {
  children: ReactNode;
};

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismissToast = useCallback((id: number) => {
    setToasts((currentToasts) => currentToasts.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((input: ToastInput) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);

    setToasts((currentToasts) => [
      ...currentToasts,
      {
        id,
        title: input.title,
        description: input.description,
        tone: input.tone ?? 'info',
      },
    ]);
  }, []);

  useEffect(() => {
    if (toasts.length === 0) {
      return undefined;
    }

    const timers = toasts.map((toast) =>
      window.setTimeout(() => {
        dismissToast(toast.id);
      }, 4000),
    );

    return () => {
      timers.forEach((timer) => {
        window.clearTimeout(timer);
      });
    };
  }, [dismissToast, toasts]);

  const value = useMemo<ToastContextValue>(
    () => ({
      showToast,
    }),
    [showToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-3"
        aria-live="polite"
        aria-atomic="true"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            data-testid="toast-item"
            className={cn(
              'pointer-events-auto rounded-surface border px-4 py-3 shadow-lg backdrop-blur',
              toastToneClassName[toast.tone],
            )}
          >
            <div className="space-y-1">
              <p className="text-sm font-semibold text-primary">{toast.title}</p>
              {toast.description ? (
                <p className="text-sm leading-5 text-secondary">{toast.description}</p>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }

  return context;
}
