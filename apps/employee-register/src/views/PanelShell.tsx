import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react';

type PanelAlign = 'top' | 'center';
type PanelScroll = 'auto' | 'hidden';

export type PanelShellProps<T extends ElementType = 'div'> = {
  as?: T;
  align?: PanelAlign;
  scroll?: PanelScroll;
  card?: boolean;
  className?: string;
  children: ReactNode;
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'className' | 'children'>;

/**
 * Panel wrapper — uses TailAdmin Card styling by default.
 *
 * `card=true` (default): rounded card with border and shadow.
 * `card=false`: transparent wrapper, no border.
 */
export function PanelShell<T extends ElementType = 'div'>({
  as,
  align = 'top',
  scroll = 'auto',
  card = true,
  className,
  children,
  ...rest
}: PanelShellProps<T>) {
  const Component = as ?? 'div';

  const alignClass = align === 'center' ? 'items-center justify-center' : 'items-start';
  const scrollClass = scroll === 'hidden' ? 'overflow-hidden' : 'overflow-y-auto';
  const cardClass = card
    ? 'rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900'
    : '';

  const classes = ['flex flex-1 min-h-0 flex-col', alignClass, scrollClass, cardClass, className]
    .filter(Boolean)
    .join(' ');

  return (
    <Component className={classes} {...rest}>
      {children}
    </Component>
  );
}
