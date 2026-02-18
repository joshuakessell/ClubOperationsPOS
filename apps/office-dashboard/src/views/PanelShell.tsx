import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react';
import './PanelShell.css';

type PanelSpacing = 'none' | 'md';

export type PanelShellProps<T extends ElementType = 'section'> = {
  as?: T;
  spacing?: PanelSpacing;
  card?: boolean;
  className?: string;
  children: ReactNode;
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'className' | 'children'>;

export function PanelShell<T extends ElementType = 'section'>({
  as,
  spacing = 'none',
  card = true,
  className,
  children,
  ...rest
}: PanelShellProps<T>) {
  const Component = (as ?? 'section') as ElementType;
  const classes = [
    'panel',
    card ? 'rounded-2xl border border-gray-700 bg-gray-800/80 p-6 shadow-lg' : '',
    spacing === 'md' ? 'panel--spaced' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Component className={classes} {...rest}>
      {children}
    </Component>
  );
}
