import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../lib/utils';
import { Button } from '../components/ui/button';

export interface KioskOptionButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'className' | 'title'
> {
  title: ReactNode;
  subtext?: ReactNode;
  price?: ReactNode;
  stacked?: boolean;
  span?: 1 | 2;
  selected?: boolean;
  staffProposed?: boolean;
  highlight?: boolean;
  pulse?: boolean;
  disabledStyle?: boolean;
  className?: string;
}

export function KioskOptionButton({
  title,
  subtext,
  price,
  stacked = false,
  span = 1,
  selected = false,
  staffProposed = false,
  highlight = false,
  pulse = false,
  disabledStyle = false,
  className,
  disabled,
  ...rest
}: KioskOptionButtonProps) {
  const showStack = stacked || Boolean(subtext) || Boolean(price);
  const tone = selected
    ? 'bg-primary text-primary-foreground border-transparent shadow-soft'
    : staffProposed
      ? 'border-primary/40 bg-primary/10 text-foreground'
      : 'border-border bg-card/90 text-foreground';

  return (
    <Button
      variant="outline"
      className={cn(
        'h-auto min-h-[92px] w-full rounded-2xl border px-5 py-4 text-center text-base font-semibold transition-all',
        'hover:-translate-y-0.5 hover:shadow-soft',
        span === 2 ? 'md:col-span-2' : '',
        tone,
        highlight ? 'ring-2 ring-primary/50 ring-offset-2 ring-offset-background' : '',
        pulse ? 'animate-pulse-soft' : '',
        disabledStyle ? 'opacity-60' : '',
        className
      )}
      disabled={disabled}
      aria-pressed={selected}
      data-selected={selected ? 'true' : 'false'}
      {...rest}
    >
      {showStack ? (
        <div className="flex flex-col items-center gap-1">
          <span className="text-lg font-semibold leading-tight">{title}</span>
          {subtext ? (
            <span className="text-sm text-muted-foreground/90">{subtext}</span>
          ) : null}
          {price ? <span className="text-xl font-extrabold">{price}</span> : null}
        </div>
      ) : (
        <span className="text-lg font-semibold">{title}</span>
      )}
    </Button>
  );
}
