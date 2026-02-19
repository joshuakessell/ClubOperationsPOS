import type { HTMLAttributes, ReactNode } from 'react';

type RaisedCardPadding = 'md' | 'lg' | 'none';

const paddingClasses: Record<RaisedCardPadding, string> = {
  md: 'p-4',
  lg: 'p-6',
  none: 'p-0',
};

export interface RaisedCardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: RaisedCardPadding;
  children: ReactNode;
}

export function RaisedCard({ padding = 'md', className, children, ...rest }: RaisedCardProps) {
  const classes = [
    'relative overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]',
    paddingClasses[padding],
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} {...rest}>
      {children}
    </div>
  );
}
