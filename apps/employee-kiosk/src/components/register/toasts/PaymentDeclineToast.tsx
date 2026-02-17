export interface PaymentDeclineToastProps {
  message: string | null;
  onDismiss: () => void;
}

export function PaymentDeclineToast({ message, onDismiss }: PaymentDeclineToastProps) {
  if (!message) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        padding: '1rem',
      }}
      role="dialog"
      aria-label="Payment Declined"
      onClick={onDismiss}
    >
      <div
        className="rounded-2xl border border-gray-200 bg-white shadow-theme-lg dark:border-gray-800 dark:bg-gray-900"
        style={{
          width: 'min(520px, 92vw)',
          background: '#ef4444',
          color: 'white',
          padding: '1rem',
          borderRadius: '12px',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.45)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'start',
            marginBottom: '0.5rem',
            gap: '1rem',
          }}
        >
          <div style={{ fontWeight: 900 }}>Payment Declined</div>
          <button
            onClick={onDismiss}
            className="inline-flex items-center justify-center rounded-lg border border-gray-200 px-2 py-1 text-sm font-semibold text-gray-700 shadow-theme-xs transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]"
            style={{
              fontSize: '1.25rem',
              cursor: 'pointer',
              padding: '0.2rem 0.55rem',
              lineHeight: 1,
            }}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
        <div style={{ fontSize: '0.95rem', fontWeight: 700 }}>{message}</div>
      </div>
    </div>
  );
}
