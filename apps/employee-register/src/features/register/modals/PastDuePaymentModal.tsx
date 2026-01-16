import { ModalFrame } from './ModalFrame';
import { Button } from '../../../ui/Button';
import { Card } from '../../../ui/Card';

export interface PastDuePaymentModalProps {
  isOpen: boolean;
  quote: {
    total: number;
    lineItems: Array<{ description: string; amount: number }>;
    messages: string[];
  };
  onPayInSquare: (outcome: 'CASH_SUCCESS' | 'CREDIT_SUCCESS' | 'CREDIT_DECLINE', declineReason?: string) => void;
  onManagerBypass: () => void;
  onClose: () => void;
  isSubmitting: boolean;
}

export function PastDuePaymentModal({
  isOpen,
  quote,
  onPayInSquare,
  onManagerBypass,
  onClose,
  isSubmitting,
}: PastDuePaymentModalProps) {
  return (
    <ModalFrame isOpen={isOpen} title={`Past Due Balance: $${quote.total.toFixed(2)}`} onClose={onClose}>
      <p className="mb-6 text-sm text-gray-600">
        Customer has a past due balance. Please process payment or bypass.
      </p>

      {(quote.lineItems.length > 0 || quote.messages.length > 0) && (
        <Card padding="md" className="mb-4 grid gap-2">
          {quote.lineItems.length > 0 && (
            <div className="grid gap-1">
              {quote.lineItems.map((li, idx) => (
                <div
                  key={`${li.description}-${idx}`}
                  className="flex items-center justify-between gap-3 text-sm font-semibold text-gray-900"
                >
                  <span className="text-gray-700">{li.description}</span>
                  <span>${li.amount.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}

          {quote.messages.length > 0 && (
            <div className="grid gap-1">
              {quote.messages.map((m, idx) => (
                <div key={idx} className="text-sm text-gray-600">
                  {m}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      <div className="mb-4 flex flex-col gap-3">
        <Button
          onClick={() => onPayInSquare('CREDIT_SUCCESS')}
          disabled={isSubmitting}
        >
          Credit Success
        </Button>
        <Button
          onClick={() => onPayInSquare('CASH_SUCCESS')}
          disabled={isSubmitting}
        >
          Cash Success
        </Button>
        <Button
          onClick={() => onPayInSquare('CREDIT_DECLINE', 'Card declined')}
          disabled={isSubmitting}
          variant="danger"
        >
          Credit Decline
        </Button>
        <Button
          onClick={onManagerBypass}
          disabled={isSubmitting}
          variant="secondary"
        >
          Manager Bypass
        </Button>
      </div>
      <Button onClick={onClose} variant="danger" className="w-full">
        Cancel
      </Button>
    </ModalFrame>
  );
}

