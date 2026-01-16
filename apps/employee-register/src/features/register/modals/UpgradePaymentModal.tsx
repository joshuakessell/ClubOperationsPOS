import { ModalFrame } from './ModalFrame';
import { Button } from '../../../ui/Button';
import { Card } from '../../../ui/Card';

export interface UpgradePaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerLabel: string;
  newRoomNumber?: string | null;
  offeredRoomNumber?: string | null;
  originalCharges: Array<{ description: string; amount: number }>;
  originalTotal: number | null;
  upgradeFee: number | null;
  paymentStatus: 'DUE' | 'PAID' | null;
  isSubmitting: boolean;
  canComplete: boolean;
  onPayCreditSuccess: () => void;
  onPayCashSuccess: () => void;
  onDecline: () => void;
  onComplete: () => void;
}

export function UpgradePaymentModal({
  isOpen,
  onClose,
  customerLabel,
  newRoomNumber,
  offeredRoomNumber,
  originalCharges,
  originalTotal,
  upgradeFee,
  paymentStatus,
  isSubmitting,
  canComplete,
  onPayCreditSuccess,
  onPayCashSuccess,
  onDecline,
  onComplete,
}: UpgradePaymentModalProps) {
  const totalDue = typeof upgradeFee === 'number' && Number.isFinite(upgradeFee) ? upgradeFee : 0;

  return (
    <ModalFrame isOpen={isOpen} title="Upgrade Payment Quote" onClose={onClose} maxWidth="560px">
      <div className="flex flex-col gap-4">
        <div>
          <div className="font-semibold text-gray-900">{customerLabel}</div>
          {(newRoomNumber || offeredRoomNumber) && (
            <div className="mt-1 text-sm text-gray-600">
              Upgrade to room {newRoomNumber || offeredRoomNumber}
            </div>
          )}
        </div>

        <Card padding="md">
          <div className="font-semibold text-gray-900">Already Paid</div>
          {originalCharges.length > 0 ? (
            <>
              {originalCharges.map((item, idx) => (
                <div
                  key={`${item.description}-${idx}`}
                  className="mt-2 flex justify-between gap-3 text-sm text-gray-600"
                >
                  <span>{item.description}</span>
                  <span>${item.amount.toFixed(2)}</span>
                </div>
              ))}
              {originalTotal !== null && (
                <div className="mt-2 flex justify-between gap-3 text-sm font-semibold text-gray-700">
                  <span>Original total</span>
                  <span>${originalTotal.toFixed(2)}</span>
                </div>
              )}
            </>
          ) : (
            <div className="mt-2 text-sm italic text-gray-600">All prior charges are settled.</div>
          )}
        </Card>

        <Card padding="md">
          <div className="font-semibold text-gray-900">New Charge</div>
          <div className="mt-2 flex justify-between gap-3 text-sm font-semibold text-gray-900">
            <span>Upgrade Fee</span>
            <span>${upgradeFee !== null && Number.isFinite(upgradeFee) ? upgradeFee.toFixed(2) : '—'}</span>
          </div>
        </Card>

        <Card padding="md" className="flex items-center justify-between">
          <div className="font-semibold text-gray-900">Total Due</div>
          <div className="font-semibold text-amber-600">${totalDue.toFixed(2)}</div>
        </Card>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Button
            onClick={onPayCreditSuccess}
            disabled={isSubmitting || !canComplete}
          >
            Credit Success
          </Button>
          <Button
            onClick={onPayCashSuccess}
            disabled={isSubmitting || !canComplete}
          >
            Cash Success
          </Button>
          <Button
            onClick={onDecline}
            disabled={isSubmitting}
            variant="danger"
          >
            Credit Decline
          </Button>
        </div>

        <div className="flex items-center justify-between">
          <div className={['text-sm font-semibold', paymentStatus === 'PAID' ? 'text-emerald-700' : 'text-amber-700'].join(' ')}>
            Status: {paymentStatus === 'PAID' ? 'Paid' : 'Payment Due'}
          </div>
          <Button
            onClick={onComplete}
            disabled={paymentStatus !== 'PAID' || isSubmitting || !canComplete}
            variant={paymentStatus === 'PAID' ? 'primary' : 'secondary'}
          >
            Complete Upgrade
          </Button>
        </div>
      </div>
    </ModalFrame>
  );
}


