import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';

export type SelectedInventoryItem = {
  type: 'room' | 'locker';
  id: string;
  number: string;
  tier: string;
};

export type PaymentQuote = {
  lineItems: Array<{ description: string; amount: number }>;
  total: number;
  messages?: string[];
};

export function AssignmentBar(props: {
  selectedInventoryItem: SelectedInventoryItem;
  customerSelectedType: string | null;
  showCustomerConfirmationPending: boolean;
  agreementSigned: boolean;
  paymentStatus: 'DUE' | 'PAID' | null;
  paymentQuote: PaymentQuote | null;
  isSubmitting: boolean;
  onAssign(): void;
  onManualSignatureOverride(): void;
  onClearSelection(): void;
  onMarkPaid(): void;
}) {
  const {
    selectedInventoryItem,
    customerSelectedType,
    showCustomerConfirmationPending,
    agreementSigned,
    paymentStatus,
    paymentQuote,
    isSubmitting,
    onAssign,
    onManualSignatureOverride,
    onClearSelection,
    onMarkPaid,
  } = props;

  return (
    <Card className="sticky bottom-0 z-50 border-t-2 border-indigo-500 bg-slate-900/85 text-white ring-slate-700">
      <div className={['flex items-center justify-between gap-4', paymentQuote ? 'mb-4' : ''].join(' ')}>
        <div className="min-w-0 flex-1">
          <div className="mb-1 text-lg font-semibold">
            Selected: {selectedInventoryItem.type === 'room' ? 'Room' : 'Locker'} {selectedInventoryItem.number}
          </div>
          {customerSelectedType && selectedInventoryItem.tier !== customerSelectedType && (
            <div className="text-sm font-semibold text-amber-300">
              Waiting for customer confirmation...
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            onClick={onAssign}
            disabled={isSubmitting || showCustomerConfirmationPending || !agreementSigned || paymentStatus !== 'PAID'}
            title={
              showCustomerConfirmationPending
                ? 'Waiting for customer confirmation'
                : paymentStatus !== 'PAID'
                  ? 'Payment must be successful before assignment'
                  : !agreementSigned
                    ? 'Waiting for customer to sign agreement'
                    : 'Assign resource'
            }
            className="px-6"
          >
            {isSubmitting
              ? 'Assigning...'
              : showCustomerConfirmationPending
                ? 'Waiting for Confirmation'
                : paymentStatus !== 'PAID'
                  ? 'Awaiting Payment'
                  : !agreementSigned
                    ? 'Awaiting Signature'
                    : 'Assign'}
          </Button>
          {!agreementSigned && paymentStatus === 'PAID' ? (
            <Button
              onClick={() => {
                if (
                  window.confirm(
                    'Override customer signature? This will complete the agreement signing process without a customer signature.'
                  )
                ) {
                  onManualSignatureOverride();
                }
              }}
              variant="danger"
              disabled={isSubmitting}
              className="px-6"
            >
              Manual Signature
            </Button>
          ) : (
            <Button
              onClick={onClearSelection}
              variant="secondary"
              disabled={isSubmitting}
              className="px-6"
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Payment Quote and Mark Paid */}
      {paymentQuote && (
        <Card padding="md" className="bg-slate-900/70 text-white ring-slate-700">
          <div className="mb-3 text-base font-semibold">Payment Quote</div>
          <div className="mb-2">
            {paymentQuote.lineItems.map((item, idx) => (
              <div key={idx} className="mb-1 flex justify-between text-sm text-white/90">
                <span>{item.description}</span>
                <span>${item.amount.toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="mb-3 flex justify-between border-t border-slate-600/60 pt-2 text-lg font-semibold">
            <span>Total Due:</span>
            <span>${paymentQuote.total.toFixed(2)}</span>
          </div>
          {paymentQuote.messages && paymentQuote.messages.length > 0 && (
            <div className="mb-3 text-xs text-slate-300">
              {paymentQuote.messages.map((msg, idx) => (
                <div key={idx}>{msg}</div>
              ))}
            </div>
          )}
          <Button
            onClick={onMarkPaid}
            disabled={isSubmitting || paymentStatus === 'PAID'}
            className={[
              'w-full',
              paymentStatus === 'PAID'
                ? 'bg-emerald-600 text-white hover:bg-emerald-600 focus-visible:ring-emerald-600/40'
                : '',
            ].join(' ')}
            variant={paymentStatus === 'PAID' ? 'secondary' : 'primary'}
          >
            {paymentStatus === 'PAID' ? '✓ Paid in Square' : 'Mark Paid in Square'}
          </Button>
        </Card>
      )}
    </Card>
  );
}

