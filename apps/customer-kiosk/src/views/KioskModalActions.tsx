import type { ReactNode } from 'react';
import { cn } from '../lib/utils';

export interface KioskModalActionsProps {
  children: ReactNode;
  className?: string;
}

export function KioskModalActions({ children, className }: KioskModalActionsProps) {
  return <div className={cn('mt-4 flex flex-col gap-3 sm:flex-row', className)}>{children}</div>;
}
