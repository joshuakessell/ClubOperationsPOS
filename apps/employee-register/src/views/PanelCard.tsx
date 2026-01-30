import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react';
import { cn } from '../lib/utils';

export type PanelCardProps<T extends ElementType = 'div'> = {
  as?: T;
  className?: string;
  children: ReactNode;
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'className' | 'children'>;

export function PanelCard<T extends ElementType = 'div'>({
  as,
  className,
  children,
  ...rest
}: PanelCardProps<T>) {
  const Component = as ?? 'div';
  const classes = cn('rounded-3xl border bg-card text-card-foreground shadow-soft', className);

  return (
    <Component className={classes} {...rest}>
      {children}
    </Component>
  );
}
