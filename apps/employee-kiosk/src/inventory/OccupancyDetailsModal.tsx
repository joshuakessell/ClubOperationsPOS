import { Button } from '@club-ops/ui/tailadmin';
import { ModalFrame } from '../components/register/modals/ModalFrame';

type OccupancyDetails = {
  type: 'room' | 'locker';
  number: string;
  occupancyId?: string;
  customerId?: string;
  customerName?: string;
  checkinAt?: string;
  checkoutAt?: string;
};

type Props = {
  occupancyDetails: OccupancyDetails | null;
  onClose: () => void;
  onRequestCheckout?: (prefill: { occupancyId?: string; number: string }) => void;
  onOpenCustomerAccount?: (customerId: string, customerLabel?: string) => void;
};

export function OccupancyDetailsModal({
  occupancyDetails,
  onClose,
  onRequestCheckout,
  onOpenCustomerAccount,
}: Props) {
  return (
    <ModalFrame
      isOpen={!!occupancyDetails}
      title={
        occupancyDetails
          ? `${occupancyDetails.type === 'room' ? 'Room' : 'Locker'} ${occupancyDetails.number}`
          : 'Occupancy'
      }
      onClose={onClose}
      maxWidth="420px"
      maxHeight="50vh"
    >
      {occupancyDetails && (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <div
            style={{
              textAlign: 'center',
              fontSize: '1.5rem',
              fontWeight: 600,
            }}
          >
            {occupancyDetails.customerId && onOpenCustomerAccount ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  onOpenCustomerAccount(occupancyDetails.customerId!, occupancyDetails.customerName)
                }
              >
                {occupancyDetails.customerName || 'Customer'}
              </Button>
            ) : (
              <span>{occupancyDetails.customerName || '—'}</span>
            )}
          </div>

          <div className="rounded-xl bg-gray-50 p-3 dark:bg-white/[0.03]">
            <div className="mb-1 text-xs text-gray-400 dark:text-gray-500">Check-in</div>
            <div className="font-extrabold text-gray-800 dark:text-white/90">
              {occupancyDetails.checkinAt
                ? new Date(occupancyDetails.checkinAt).toLocaleString()
                : '—'}
            </div>
          </div>

          <div className="rounded-xl bg-gray-50 p-3 dark:bg-white/[0.03]">
            <div className="mb-1 text-xs text-gray-400 dark:text-gray-500">Checkout</div>
            <div className="font-extrabold text-gray-800 dark:text-white/90">
              {occupancyDetails.checkoutAt
                ? new Date(occupancyDetails.checkoutAt).toLocaleString()
                : '—'}
            </div>
          </div>

          <div className="flex justify-center">
            <Button
              onClick={() => {
                onRequestCheckout?.({
                  occupancyId: occupancyDetails.occupancyId,
                  number: occupancyDetails.number,
                });
                onClose();
              }}
            >
              Checkout
            </Button>
          </div>
        </div>
      )}
    </ModalFrame>
  );
}
