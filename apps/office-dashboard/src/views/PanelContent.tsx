import type { HTMLAttributes, ReactNode } from 'react';

type PanelPadding = 'lg' | 'md' | 'compact' | 'none';

const paddingClasses: Record<PanelPadding, string> = {
  lg: 'p-8',
  md: 'p-5',
  compact: 'px-6 py-4',
  none: 'p-0',
};

export interface PanelContentProps extends HTMLAttributes<HTMLDivElement> {
  padding?: PanelPadding;
  children: ReactNode;
}

export function PanelContent({ padding = 'lg', className, children, ...rest }: PanelContentProps) {
  const classes = [paddingClasses[padding], className].filter(Boolean).join(' ');

  return (
    <div className={classes} {...rest}>
      {children}
    </div>
  );
}
