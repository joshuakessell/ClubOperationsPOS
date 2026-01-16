import { ModalFrame } from './ModalFrame';
import { Button } from '../../../ui/Button';

export type ActiveCheckinDetails = {
  visitId: string;
  rentalType: string | null;
  assignedResourceType: 'room' | 'locker' | null;
  assignedResourceNumber: string | null;
  checkinAt: string | null;
  checkoutAt: string | null;
  overdue: boolean | null;
  waitlist:
    | null
    | {
        id: string;
        desiredTier: string;
        backupTier: string;
        status: string;
      };
};

export interface AlreadyCheckedInModalProps {
  isOpen: boolean;
  customerLabel?: string | null;
  activeCheckin: ActiveCheckinDetails | null;
  onClose: () => void;
}

export function AlreadyCheckedInModal({
  isOpen,
  customerLabel,
  activeCheckin,
  onClose,
}: AlreadyCheckedInModalProps) {
  const assignedLabel =
    activeCheckin?.assignedResourceType && activeCheckin?.assignedResourceNumber
      ? `${activeCheckin.assignedResourceType === 'room' ? 'Room' : 'Locker'} ${
          activeCheckin.assignedResourceNumber
        }`
      : '—';

  const checkoutAtLabel = activeCheckin?.checkoutAt ? new Date(activeCheckin.checkoutAt).toLocaleString() : '—';
  const checkinAtLabel = activeCheckin?.checkinAt ? new Date(activeCheckin.checkinAt).toLocaleString() : '—';

  return (
    <ModalFrame isOpen={isOpen} title="Already Checked In" onClose={onClose}>
      <div className="mb-4">
        {customerLabel ? (
          <div className="mb-2 text-base font-semibold text-gray-900">{customerLabel}</div>
        ) : null}
        <div className="text-sm leading-6 text-gray-700">
          This customer currently has an active check-in. Please use the current visit (or check them out) instead of
          starting a new check-in.
        </div>
      </div>

      <div className="grid gap-3 mb-4">
        <div>
          <div className="text-xs font-semibold text-gray-500">Assigned</div>
          <div className="font-semibold text-gray-900">{assignedLabel}</div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-xs font-semibold text-gray-500">Check-in</div>
            <div className="font-medium text-gray-900">{checkinAtLabel}</div>
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-500">Checkout</div>
            <div className="font-medium text-gray-900">
              {checkoutAtLabel}{' '}
              {activeCheckin?.overdue ? <span className="text-amber-600">(overdue)</span> : null}
            </div>
          </div>
        </div>
        {activeCheckin?.waitlist ? (
          <div>
            <div className="text-xs font-semibold text-gray-500">Pending upgrade request</div>
            <div className="font-semibold text-gray-900">
              {activeCheckin.waitlist.desiredTier} (backup: {activeCheckin.waitlist.backupTier}) •{' '}
              {activeCheckin.waitlist.status}
            </div>
          </div>
        ) : null}
      </div>

      <Button onClick={onClose} className="w-full">
        OK
      </Button>
    </ModalFrame>
  );
}

