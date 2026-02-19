import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react';

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
    'relative overflow-hidden',
    card
      ? 'rounded-2xl border border-gray-200 bg-white px-5 py-7 dark:border-gray-800 dark:bg-white/[0.03] xl:px-10 xl:py-12'
      : '',
    spacing === 'md' ? 'mb-6' : '',
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
