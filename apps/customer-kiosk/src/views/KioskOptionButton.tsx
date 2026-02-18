import type { ButtonHTMLAttributes, ReactNode } from 'react';

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

  const base =
    'flex items-center justify-center rounded-lg border px-5 py-4 text-center font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500/40';

  const variant = selected
    ? 'border-brand-500 bg-brand-500/20 text-brand-300 shadow-md'
    : staffProposed
      ? 'border-amber-400/60 bg-amber-500/10 text-amber-300 animate-pulse'
      : 'border-gray-700 bg-gray-800 text-white hover:border-brand-500/40 hover:bg-gray-700';

  const disabledCls = disabledStyle || disabled
    ? 'opacity-50 cursor-not-allowed'
    : '';

  const highlightCls = highlight ? 'ring-2 ring-brand-400/50' : '';
  const pulseCls = pulse && !staffProposed ? 'animate-pulse' : '';
  const spanCls = span === 2 ? 'col-span-2' : '';

  const classes = [base, variant, disabledCls, highlightCls, pulseCls, spanCls, className]
    .filter(Boolean)
    .join(' ');

  return (
    <button className={classes} disabled={disabled} {...rest}>
      {showStack ? (
        <div className="flex flex-col items-center gap-1">
          <span className="text-lg font-semibold">{title}</span>
          {subtext ? <span className="text-sm text-gray-400">{subtext}</span> : null}
          {price ? <span className="text-sm font-medium text-brand-300">{price}</span> : null}
        </div>
      ) : (
        <span className="text-lg font-semibold">{title}</span>
      )}
    </button>
  );
}
