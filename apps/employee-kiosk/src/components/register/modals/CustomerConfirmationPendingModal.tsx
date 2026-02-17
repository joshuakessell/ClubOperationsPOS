import { ModalFrame } from './ModalFrame';

export interface CustomerConfirmationPendingModalProps {
  isOpen: boolean;
  data: {
    requested: string;
    selected: string;
    number: string;
  };
  onCancel?: () => void;
}

export function CustomerConfirmationPendingModal({
  isOpen,
  data,
  onCancel,
}: CustomerConfirmationPendingModalProps) {
  return (
    <ModalFrame
      isOpen={isOpen}
      title="Waiting for Customer Confirmation"
      onClose={() => {}}
      closeOnOverlayClick={false}
    >
      <p style={{ marginBottom: '1.5rem', lineHeight: '1.6' }}>
        Staff selected a different option: {data.selected} {data.number}. Waiting for customer to
        accept or decline on their device.
      </p>
      {onCancel && (
        <button
          onClick={onCancel}
          className="inline-flex items-center justify-center rounded-lg border border-error-300 bg-error-50 px-4 py-2.5 text-sm font-semibold text-error-600 shadow-theme-xs transition hover:bg-error-100 dark:border-error-700 dark:bg-error-500/10 dark:text-error-400 dark:hover:bg-error-500/20"
          style={{
            width: '100%',
            padding: '0.75rem',
            fontSize: '1rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      )}
    </ModalFrame>
  );
}
