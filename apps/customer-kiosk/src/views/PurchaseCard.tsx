import type { ReactNode } from 'react';
import { cn } from '../lib/utils';
import { Card } from '../components/ui/card';

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
  const tone =
    variant === 'membership'
      ? 'border-blue-200/70'
      : variant === 'rental'
        ? 'border-emerald-200/70'
        : 'border-border';

  return (
    <Card
      className={cn(
        'shadow-soft transition-all',
        tone,
        active ? 'ring-2 ring-primary/40' : '',
        className
      )}
    >
      <div className="flex items-center justify-between gap-4 px-6 pt-6">
        <div className="text-lg font-semibold">{title}</div>
        {status ? <div className="text-sm text-muted-foreground">{status}</div> : null}
      </div>
      <div className="px-6 pb-6 pt-4">{children}</div>
    </Card>
  );
}
