import type { ReactNode } from 'react';
import { cn } from '../lib/utils';

type PanelHeaderAlign = 'start' | 'center';
type PanelHeaderLayout = 'stacked' | 'inline';
type PanelHeaderSpacing = 'none' | 'sm' | 'md';

export interface PanelHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  align?: PanelHeaderAlign;
  layout?: PanelHeaderLayout;
  spacing?: PanelHeaderSpacing;
  className?: string;
}

export function PanelHeader({
  title,
  subtitle,
  action,
  align = 'start',
  layout = 'stacked',
  spacing = 'md',
  className,
}: PanelHeaderProps) {
  const isInline = layout === 'inline';
  const classes = cn(
    'flex flex-col gap-2',
    align === 'center' ? 'items-center text-center' : 'items-start text-left',
    isInline ? 'sm:flex-row sm:items-center sm:justify-between' : '',
    spacing === 'none' ? '' : spacing === 'sm' ? 'mb-2' : 'mb-4',
    className
  );

  return (
    <div className={classes}>
      <div className={cn('flex w-full flex-col gap-2', isInline ? 'sm:flex-row sm:items-center sm:justify-between' : '')}>
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">{title}</h2>
          {isInline && subtitle ? (
            <div className="text-sm text-muted-foreground">{subtitle}</div>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {!isInline && subtitle ? (
        <div className="text-sm text-muted-foreground">{subtitle}</div>
      ) : null}
    </div>
  );
}
