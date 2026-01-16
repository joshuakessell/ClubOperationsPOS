import type { HTMLAttributes, ReactNode } from 'react';

export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

export type CardProps = HTMLAttributes<HTMLDivElement> & {
  padding?: CardPadding;
  children?: ReactNode;
};

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(' ');
}

const PADDING_CLASS: Record<CardPadding, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

export function Card({ padding = 'md', className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-xl bg-white shadow-sm ring-1 ring-gray-200',
        PADDING_CLASS[padding],
        className
      )}
      {...props}
    />
  );
}

