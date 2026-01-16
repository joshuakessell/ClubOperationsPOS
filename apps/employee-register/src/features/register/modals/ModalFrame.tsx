import { ReactNode } from 'react';
import { Modal } from '../../../ui/Modal';
import { Button } from '../../../ui/Button';

export interface ModalFrameProps {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: string;
  maxHeight?: string;
  closeOnOverlayClick?: boolean;
}

const MAX_WIDTH_TO_MODAL: Array<{ match: RegExp; width: 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' }> =
  [
    { match: /760|768/, width: '3xl' },
    { match: /720/, width: '3xl' },
    { match: /600|560|576/, width: 'xl' },
    { match: /520|512/, width: 'lg' },
  ];

const MAX_HEIGHT_CLASS: Record<string, string> = {
  '70vh': 'max-h-[70vh]',
  '80vh': 'max-h-[80vh]',
};

export function ModalFrame({
  isOpen,
  title,
  onClose,
  children,
  maxWidth = '500px',
  maxHeight,
  closeOnOverlayClick = true,
}: ModalFrameProps) {
  if (!isOpen) return null;

  const width =
    MAX_WIDTH_TO_MODAL.find((m) => m.match.test(maxWidth))?.width ?? ('md' as const);
  const bodyMaxHClass = maxHeight ? MAX_HEIGHT_CLASS[maxHeight] ?? 'max-h-[80vh]' : undefined;

  return (
    <Modal
      open={isOpen}
      width={width}
      onClose={closeOnOverlayClick ? onClose : undefined}
      panelClassName="p-0 overflow-hidden"
    >
      <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
        <h2 className="m-0 text-lg font-semibold text-gray-900">{title}</h2>
        <Button variant="ghost" onClick={onClose} aria-label="Close">
          ×
        </Button>
      </div>
      <div className={['px-6 py-4', bodyMaxHClass ? `overflow-y-auto ${bodyMaxHClass}` : undefined].filter(Boolean).join(' ')}>
        {children}
      </div>
    </Modal>
  );
}

