import type { ReactNode } from 'react';

export interface PurchaseCardProps {
  title: ReactNode;
  status?: ReactNode;
  variant?: 'membership' | 'rental';
  active?: boolean;
  className?: string;
  children: ReactNode;
}

export function PurchaseCard({
  title,
  status,
  variant,
  active = false,
  className,
  children,
}: PurchaseCardProps) {
  const variantAccent =
    variant === 'membership'
      ? 'border-brand-500/30'
      : variant === 'rental'
        ? 'border-amber-500/30'
        : 'border-gray-700';

  const activeCls = active ? 'ring-2 ring-brand-400/40 border-brand-500/50' : '';

  const classes = [
    'rounded-2xl border bg-gray-800/80 p-6 shadow-lg backdrop-blur-sm transition-all duration-200',
    variantAccent,
    activeCls,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <section className={classes}>
      <div className="mb-4 flex items-center justify-between">
        <div className="text-lg font-bold text-white">{title}</div>
        {status ? <div className="text-sm text-gray-400">{status}</div> : null}
      </div>
      <div>{children}</div>
    </section>
  );
}
