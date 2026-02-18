import type { ReactNode } from 'react';

export interface KioskNoticeBannerProps {
  tone?: 'info' | 'success' | 'warning' | 'muted';
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}

const toneMap: Record<string, string> = {
  info: 'border-brand-500/40 bg-brand-500/10 text-brand-300',
  success: 'border-green-500/40 bg-green-500/10 text-green-300',
  warning: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  muted: 'border-gray-700 bg-gray-800/60 text-gray-300',
};

export function KioskNoticeBanner({
  tone = 'muted',
  title,
  children,
  className,
}: KioskNoticeBannerProps) {
  const showBody = Boolean(children);

  const classes = [
    'rounded-xl border px-5 py-4 text-center',
    toneMap[tone] ?? toneMap.muted,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes}>
      {title ? (
        <div className={`font-semibold${showBody ? ' mb-2' : ''}`}>{title}</div>
      ) : null}
      {children}
    </div>
  );
}
