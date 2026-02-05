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
          ? `${occupancyDetails.type === 'room' ? 'Room' : 'Locker'} ${
              occupancyDetails.number
            }`
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
              <button
                type="button"
                className="cs-liquid-button cs-liquid-button--secondary"
                style={{ padding: '0.35rem 0.7rem', minHeight: 'unset', fontWeight: 900 }}
                onClick={() =>
                  onOpenCustomerAccount(
                    occupancyDetails.customerId!,
                    occupancyDetails.customerName
                  )
                }
              >
                {occupancyDetails.customerName || 'Customer'}
              </button>
            ) : (
              <span>{occupancyDetails.customerName || '—'}</span>
            )}
          </div>

          <div className="er-surface" style={{ padding: '0.75rem', borderRadius: 12 }}>
            <div className="er-text-sm" style={{ color: '#94a3b8', marginBottom: '0.25rem' }}>
              Check-in
            </div>
            <div style={{ fontWeight: 800 }}>
              {occupancyDetails.checkinAt
                ? new Date(occupancyDetails.checkinAt).toLocaleString()
                : '—'}
            </div>
          </div>

          <div className="er-surface" style={{ padding: '0.75rem', borderRadius: 12 }}>
            <div className="er-text-sm" style={{ color: '#94a3b8', marginBottom: '0.25rem' }}>
              Checkout
            </div>
            <div style={{ fontWeight: 800 }}>
              {occupancyDetails.checkoutAt
                ? new Date(occupancyDetails.checkoutAt).toLocaleString()
                : '—'}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button
              type="button"
              className="cs-liquid-button"
              onClick={() => {
                onRequestCheckout?.({
                  occupancyId: occupancyDetails.occupancyId,
                  number: occupancyDetails.number,
                });
                onClose();
              }}
            >
              Checkout
            </button>
          </div>
        </div>
      )}
    </ModalFrame>
  );
}
