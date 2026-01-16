import { RoomStatus } from '@club-ops/shared';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

export interface OverrideModalProps {
  isOpen: boolean;
  roomNumber: string;
  fromStatus: RoomStatus;
  toStatus: RoomStatus;
  reason: string;
  onChangeReason: (reason: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function OverrideModal({
  isOpen,
  roomNumber,
  fromStatus,
  toStatus,
  reason,
  onChangeReason,
  onConfirm,
  onCancel,
}: OverrideModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onCancel} title="Override Required" width="lg">
      <div className="grid gap-4">
        <p className="text-sm text-gray-600">
          Room <span className="font-semibold">{roomNumber}</span>: {fromStatus} → {toStatus}
        </p>
        <p className="text-sm text-amber-700">
          This transition skips a step and requires a reason.
        </p>
        <div>
          <label className="block text-sm font-medium text-gray-900">Reason</label>
          <textarea
            className="mt-2 block w-full rounded-md border border-gray-300 bg-white p-3 text-base text-gray-900 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            placeholder="Enter reason for override..."
            value={reason}
            onChange={(e) => onChangeReason(e.target.value)}
            rows={4}
          />
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={!reason.trim()}>
            Confirm Override
          </Button>
        </div>
      </div>
    </Modal>
  );
}

