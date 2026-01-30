import { type ReactNode } from 'react';
import { cn } from '../lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';

export interface KioskModalProps {
  isOpen: boolean;
  title: ReactNode;
  onClose?: () => void;
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
  lockFocus?: boolean;
  children: ReactNode;
  className?: string;
}

export function KioskModal({
  isOpen,
  title,
  onClose,
  closeOnOverlayClick = false,
  closeOnEscape = false,
  lockFocus = true,
  children,
  className,
}: KioskModalProps) {
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose?.();
      }}
      modal={lockFocus}
    >
      <DialogContent
        className={cn('max-w-3xl', className)}
        onPointerDownOutside={(event) => {
          if (!closeOnOverlayClick) event.preventDefault();
        }}
        onEscapeKeyDown={(event) => {
          if (!closeOnEscape) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold">{title}</DialogTitle>
        </DialogHeader>
        <div className="mt-3">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
