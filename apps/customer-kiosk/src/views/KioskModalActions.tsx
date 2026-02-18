import type { ReactNode } from 'react';

export interface KioskModalActionsProps {
  children: ReactNode;
  className?: string;
}

export function KioskModalActions({ children, className }: KioskModalActionsProps) {
  return (
    <div
      className={['mt-6 flex items-center justify-center gap-4', className]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  );
}
