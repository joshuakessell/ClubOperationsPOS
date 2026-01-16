import { ModalFrame } from './ModalFrame';
import { PinInput } from '@club-ops/ui';
import { Button } from '../../../ui/Button';

export interface ManagerBypassModalProps {
  isOpen: boolean;
  managers: Array<{ id: string; name: string }>;
  managerId: string;
  managerPin: string;
  onChangeManagerId: (id: string) => void;
  onChangeManagerPin: (pin: string) => void;
  onBypass: () => void;
  onCancel: () => void;
  isSubmitting: boolean;
}

export function ManagerBypassModal({
  isOpen,
  managers,
  managerId,
  managerPin,
  onChangeManagerId,
  onChangeManagerPin,
  onBypass,
  onCancel,
  isSubmitting,
}: ManagerBypassModalProps) {
  return (
    <ModalFrame isOpen={isOpen} title="Manager Bypass" onClose={onCancel}>
      <div className="mb-4">
        <label className="mb-2 block text-sm font-semibold text-gray-900">Select Manager</label>
        <select
          value={managerId}
          onChange={(e) => onChangeManagerId(e.target.value)}
          className="form-select block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-600 focus:ring-indigo-600/30"
        >
          <option value="">Select a manager...</option>
          {managers.map((manager) => (
            <option key={manager.id} value={manager.id}>
              {manager.name}
            </option>
          ))}
        </select>
      </div>
      <div className="mb-6">
        <label className="mb-2 block text-sm font-semibold text-gray-900">PIN</label>
        <PinInput
          length={6}
          value={managerPin}
          onChange={onChangeManagerPin}
          onSubmit={() => {
            if (!managerId) return;
            if (managerPin.trim().length !== 6) return;
            onBypass();
          }}
          submitLabel={isSubmitting ? 'Processing…' : 'Bypass'}
          submitDisabled={isSubmitting || !managerId}
          disabled={isSubmitting}
          displayAriaLabel="Manager PIN"
        />
      </div>
      <div className="flex gap-3">
        <Button
          onClick={onBypass}
          disabled={isSubmitting || !managerId || managerPin.trim().length !== 6}
          className="flex-1"
        >
          {isSubmitting ? 'Processing...' : 'Bypass'}
        </Button>
        <Button
          onClick={onCancel}
          variant="danger"
          className="flex-1"
        >
          Cancel
        </Button>
      </div>
    </ModalFrame>
  );
}

