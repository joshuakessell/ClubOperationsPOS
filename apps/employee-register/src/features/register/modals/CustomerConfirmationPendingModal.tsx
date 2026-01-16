import { ModalFrame } from './ModalFrame';
import { Button } from '../../../ui/Button';

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
      <p className="mb-6 text-sm leading-6 text-gray-700">
        Staff selected a different option: {data.selected} {data.number}. Waiting for customer to
        accept or decline on their device.
      </p>
      {onCancel && (
        <Button onClick={onCancel} variant="danger" className="w-full">
          Cancel
        </Button>
      )}
    </ModalFrame>
  );
}

