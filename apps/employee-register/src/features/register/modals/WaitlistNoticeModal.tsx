import { ModalFrame } from './ModalFrame';
import { Button } from '../../../ui/Button';

export interface WaitlistNoticeModalProps {
  isOpen: boolean;
  desiredTier: string;
  backupType: string;
  onClose: () => void;
}

export function WaitlistNoticeModal({
  isOpen,
  desiredTier,
  backupType,
  onClose,
}: WaitlistNoticeModalProps) {
  return (
    <ModalFrame isOpen={isOpen} title="Waitlist Notice" onClose={onClose}>
      <p className="mb-6 text-sm leading-6 text-gray-700">
        Customer requested waitlist for {desiredTier}. Assigning a {backupType} in the meantime.
      </p>
      <Button onClick={onClose} className="w-full">
        OK
      </Button>
    </ModalFrame>
  );
}

