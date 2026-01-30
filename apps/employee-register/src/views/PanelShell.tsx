import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react';
import { cn } from '../lib/utils';

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
  const classes = cn(
    'flex h-full w-full flex-col gap-4 rounded-3xl border border-border bg-card p-6 text-card-foreground shadow-soft',
    align === 'center' ? 'items-center justify-center text-center' : 'items-stretch',
    scroll === 'hidden' ? 'overflow-hidden' : 'overflow-auto',
    card ? '' : 'border-none bg-transparent shadow-none p-0',
    className
  );

  return (
    <Component className={classes} {...rest}>
      {children}
    </Component>
  );
}
