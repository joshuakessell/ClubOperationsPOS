import type { ReactNode } from 'react';

export type ModalWidth = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';

export type ModalProps = {
  open: boolean;
  onClose?: () => void;
  title?: ReactNode;
  children: ReactNode;
  width?: ModalWidth;
  /**
   * Extra classes for the modal panel (NOT the backdrop).
   * Useful for app wrappers to set width/padding defaults without re-implementing behavior.
   */
  panelClassName?: string;
};

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(' ');
}

const WIDTH_CLASS: Record<ModalWidth, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
};

export function Modal({
  open,
  onClose,
  title,
  children,
  width = 'md',
  panelClassName,
}: ModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 cursor-default bg-black/40"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative w-full rounded-xl bg-white shadow-xl ring-1 ring-black/10',
          WIDTH_CLASS[width],
          'p-6',
          panelClassName
        )}
      >
        {title ? <div className="mb-4 text-lg font-semibold text-gray-900">{title}</div> : null}
        {children}
      </div>
    </div>
  );
}

