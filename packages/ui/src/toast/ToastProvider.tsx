import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ToastItem, ToastVariant } from './types';

type ToastInput = {
  title?: string;
  message: string;
  variant?: ToastVariant;
  durationMs?: number;
};

type ToastApi = {
  notify: (toast: ToastInput) => string;
  dismiss: (id: string) => void;
  clear: () => void;
  info: (message: string, opts?: Omit<ToastInput, 'message' | 'variant'>) => string;
  success: (message: string, opts?: Omit<ToastInput, 'message' | 'variant'>) => string;
  error: (message: string, opts?: Omit<ToastInput, 'message' | 'variant'>) => string;
};

const ToastContext = createContext<ToastApi | null>(null);

function genId(): string {
  // Good enough for UI keys; no crypto requirement.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function variantClasses(variant: ToastVariant): string {
  if (variant === 'success') return 'border-emerald-500/30 bg-emerald-950/60 text-emerald-50';
  if (variant === 'error') return 'border-red-500/30 bg-red-950/60 text-red-50';
  return 'border-sky-500/30 bg-slate-950/60 text-slate-50';
}

export function ToastProvider(props: { children: ReactNode }): JSX.Element {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<string, number>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timers = timersRef.current;
    const timer = timers.get(id);
    if (timer != null) {
      window.clearTimeout(timer);
      timers.delete(id);
    }
  }, []);

  const clear = useCallback(() => {
    setToasts([]);
    const timers = timersRef.current;
    for (const timer of timers.values()) window.clearTimeout(timer);
    timers.clear();
  }, []);

  const notify = useCallback(
    (input: ToastInput): string => {
      const id = genId();
      const item: ToastItem = {
        id,
        title: input.title,
        message: input.message,
        variant: input.variant ?? 'info',
        createdAt: Date.now(),
        durationMs: input.durationMs ?? 3500,
      };
      setToasts((prev) => [item, ...prev].slice(0, 5));

      const duration = Math.max(1000, item.durationMs);
      const timer = window.setTimeout(() => dismiss(id), duration);
      timersRef.current.set(id, timer);
      return id;
    },
    [dismiss]
  );

  const api = useMemo<ToastApi>(
    () => ({
      notify,
      dismiss,
      clear,
      info: (message, opts) => notify({ ...opts, message, variant: 'info' }),
      success: (message, opts) => notify({ ...opts, message, variant: 'success' }),
      error: (message, opts) => notify({ ...opts, message, variant: 'error' }),
    }),
    [dismiss, notify, clear]
  );

  return (
    <ToastContext.Provider value={api}>
      {props.children}
      <div
        className="pointer-events-none fixed right-4 top-4 z-[1000] flex w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-3"
        aria-live="polite"
        aria-relevant="additions"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={[
              'pointer-events-auto rounded-xl border p-4 shadow-lg backdrop-blur',
              variantClasses(t.variant),
            ].join(' ')}
            role="status"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                {t.title ? <div className="text-sm font-semibold">{t.title}</div> : null}
                <div className="mt-1 break-words text-sm opacity-95">{t.message}</div>
              </div>
              <button
                type="button"
                className="rounded-md px-2 py-1 text-xs font-semibold opacity-80 hover:opacity-100"
                onClick={() => dismiss(t.id)}
              >
                Dismiss
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}

