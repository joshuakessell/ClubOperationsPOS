import type { ReactNode } from 'react';
import { cn } from '../lib/utils';
import { Card } from '../components/ui/card';

type MessageCardTone = 'glass' | 'muted';
type MessageCardSize = 'compact' | 'wide';

export interface KioskMessageCardProps {
  title: ReactNode;
  body?: ReactNode;
  tone?: MessageCardTone;
  size?: MessageCardSize;
  className?: string;
  titleClassName?: string;
  bodyClassName?: string;
}

export function KioskMessageCard({
  title,
  body,
  tone = 'glass',
  size = 'wide',
  className,
  titleClassName,
  bodyClassName,
}: KioskMessageCardProps) {
  const toneClasses =
    tone === 'glass'
      ? 'glass-panel border-white/40'
      : 'bg-muted/70 border-muted text-muted-foreground';
  const sizeClasses = size === 'compact' ? 'px-5 py-4' : 'px-8 py-6';
  const titleClasses = size === 'compact' ? 'text-lg' : 'text-2xl';
  const bodyClasses = size === 'compact' ? 'text-sm' : 'text-base';

  return (
    <Card className={cn('shadow-soft', toneClasses, sizeClasses, className)}>
      <div
        className={cn('font-semibold text-foreground', titleClasses, titleClassName)}
      >
        {title}
      </div>
      {body ? (
        <div className={cn('mt-2 text-foreground/80', bodyClasses, bodyClassName)}>
          {body}
        </div>
      ) : null}
    </Card>
  );
}
