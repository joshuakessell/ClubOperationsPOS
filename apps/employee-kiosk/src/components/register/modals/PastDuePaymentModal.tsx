import { ModalFrame } from './ModalFrame';

export interface PastDuePaymentModalProps {
  isOpen: boolean;
  quote: {
    total: number;
    lineItems: Array<{ description: string; amount: number }>;
    messages: string[];
  };
  onPayInSquare: (
    outcome: 'CASH_SUCCESS' | 'CREDIT_SUCCESS' | 'CREDIT_DECLINE',
    declineReason?: string
  ) => void;
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
    <ModalFrame
      isOpen={isOpen}
      title={`Past Due Balance: $${quote.total.toFixed(2)}`}
      onClose={onClose}
      closeOnOverlayClick={false}
      showCloseButton={false}
    >
      <p style={{ marginBottom: '1.5rem', color: '#94a3b8' }}>
        Customer has a past due balance. Please process payment or bypass.
      </p>

      {(quote.lineItems.length > 0 || quote.messages.length > 0) && (
        <div
          className="rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-white/[0.03]"
          style={{ padding: '0.75rem', marginBottom: '1rem', display: 'grid', gap: '0.5rem' }}
        >
          {quote.lineItems.length > 0 && (
            <div style={{ display: 'grid', gap: '0.35rem' }}>
              {quote.lineItems.map((li, idx) => (
                <div
                  key={`${li.description}-${idx}`}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: '0.75rem',
                    color: '#e2e8f0',
                    fontWeight: 700,
                  }}
                >
                  <span style={{ color: '#cbd5e1' }}>{li.description}</span>
                  <span>${li.amount.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}

          {quote.messages.length > 0 && (
            <div style={{ display: 'grid', gap: '0.25rem' }}>
              {quote.messages.map((m, idx) => (
                <div key={idx} style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
                  {m}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          marginBottom: '1rem',
        }}
      >
        <button
          onClick={() => onPayInSquare('CREDIT_SUCCESS')}
          disabled={isSubmitting}
          className="inline-flex items-center justify-center rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-theme-xs transition hover:bg-brand-600"
          style={{
            padding: '0.75rem',
            fontSize: '1rem',
            fontWeight: 600,
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
          }}
        >
          Credit Success
        </button>
        <button
          onClick={() => onPayInSquare('CASH_SUCCESS')}
          disabled={isSubmitting}
          className="inline-flex items-center justify-center rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-theme-xs transition hover:bg-brand-600"
          style={{
            padding: '0.75rem',
            fontSize: '1rem',
            fontWeight: 600,
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
          }}
        >
          Cash Success
        </button>
        <button
          onClick={() => onPayInSquare('CREDIT_DECLINE', 'Card declined')}
          disabled={isSubmitting}
          className="inline-flex items-center justify-center rounded-lg border border-error-300 bg-error-50 px-4 py-2.5 text-sm font-semibold text-error-600 shadow-theme-xs transition hover:bg-error-100 dark:border-error-700 dark:bg-error-500/10 dark:text-error-400 dark:hover:bg-error-500/20"
          style={{
            padding: '0.75rem',
            fontSize: '1rem',
            fontWeight: 600,
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
          }}
        >
          Credit Decline
        </button>
        <button
          onClick={onManagerBypass}
          disabled={isSubmitting}
          className="inline-flex items-center justify-center rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-theme-xs transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]"
          style={{
            padding: '0.75rem',
            fontSize: '1rem',
            fontWeight: 600,
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
          }}
        >
          Manager Bypass
        </button>
      </div>
    </ModalFrame>
  );
}
