import type { ReactNode } from 'react';
import { cn } from '../lib/utils';

export interface KioskNoticeBannerProps {
  tone?: 'info' | 'success' | 'muted';
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function KioskNoticeBanner({
  tone = 'muted',
  title,
  children,
  className,
}: KioskNoticeBannerProps) {
  const toneClasses =
    tone === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
      : tone === 'info'
        ? 'border-blue-200 bg-blue-50 text-blue-900'
        : 'border-border bg-muted/70 text-foreground';
  const showBody = Boolean(children);

  return (
    <div
      className={cn(
        'rounded-2xl border px-4 py-3 text-sm font-medium shadow-soft animate-in fade-in-0',
        toneClasses,
        className
      )}
    >
      {title ? (
        <div className={cn('text-base font-semibold', !showBody && 'text-sm')}>{title}</div>
      ) : null}
      {children ? <div className="mt-1 text-sm text-foreground/80">{children}</div> : null}
    </div>
  );
}
