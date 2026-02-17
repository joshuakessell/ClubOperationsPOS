type Props = {
  splitBaseTotal: number;
  cardAmountInput: string;
  cashAmountInput: string;
  splitError: string | null;
  splitTotalsMatch: boolean;
  resolvedCashAmount: number | null;
  splitCommitted: boolean;
  isSubmitting: boolean;
  isProcessingCard: boolean;
  cardAmountValid: boolean;
  cashAmountValid: boolean;
  onCardAmountChange: (value: string) => void;
  onCashAmountChange: (value: string) => void;
  onBack: () => void;
  onCreditFail: () => void;
  onProcessCard: () => void;
  onCashSuccess: () => void;
};

export function RequiredTenderSplitPanel({
  splitBaseTotal,
  cardAmountInput,
  cashAmountInput,
  splitError,
  splitTotalsMatch,
  resolvedCashAmount,
  splitCommitted,
  isSubmitting,
  isProcessingCard,
  cardAmountValid,
  cashAmountValid,
  onCardAmountChange,
  onCashAmountChange,
  onBack,
  onCreditFail,
  onProcessCard,
  onCashSuccess,
}: Props) {
  return (
    <div className="er-required-modal__split-panel">
      <div className="er-required-modal__split-title">Split Payment</div>
      <div className="er-required-modal__split-grid">
        <label className="er-required-modal__split-field">
          <span className="er-required-modal__split-label">Card amount</span>
          <div className="er-required-modal__split-input">
            <span>$</span>
            <input
              type="text"
              inputMode="decimal"
              placeholder={splitBaseTotal.toFixed(2)}
              value={cardAmountInput}
              onChange={(e) => onCardAmountChange(e.target.value)}
              disabled={isSubmitting || splitCommitted}
              aria-label="Card amount"
            />
          </div>
        </label>
        <label className="er-required-modal__split-field">
          <span className="er-required-modal__split-label">Cash amount</span>
          <div className="er-required-modal__split-input">
            <span>$</span>
            <input
              type="text"
              inputMode="decimal"
              placeholder={splitBaseTotal.toFixed(2)}
              value={cashAmountInput}
              onChange={(e) => onCashAmountChange(e.target.value)}
              disabled={isSubmitting || splitCommitted}
              aria-label="Cash amount"
            />
          </div>
        </label>
      </div>
      <div
        className={[
          'er-required-modal__split-hint',
          splitError ? 'er-required-modal__split-hint--error' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {splitError
          ? splitError
          : splitTotalsMatch && resolvedCashAmount !== null
            ? splitCommitted
              ? `Card approved. Collect $${resolvedCashAmount.toFixed(2)} cash.`
              : `Cash due: $${resolvedCashAmount.toFixed(2)}`
            : 'Enter a card or cash amount less than the total.'}
      </div>
      <div className="er-required-modal__split-actions">
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-theme-xs transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]"
          onClick={onBack}
          disabled={isSubmitting || splitCommitted}
        >
          Back
        </button>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-lg border border-error-300 bg-error-50 px-4 py-2.5 text-sm font-semibold text-error-600 shadow-theme-xs transition hover:bg-error-100 dark:border-error-700 dark:bg-error-500/10 dark:text-error-400 dark:hover:bg-error-500/20"
          onClick={onCreditFail}
          disabled={isSubmitting || splitCommitted}
        >
          Credit Fail
        </button>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-theme-xs transition hover:bg-brand-600"
          onClick={onProcessCard}
          disabled={
            isSubmitting ||
            isProcessingCard ||
            splitCommitted ||
            !cardAmountValid ||
            !splitTotalsMatch
          }
        >
          {isProcessingCard
            ? 'Processing Card...'
            : splitCommitted
              ? 'Card Approved'
              : 'Process Card'}
        </button>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-theme-xs transition hover:bg-brand-600"
          onClick={onCashSuccess}
          disabled={isSubmitting || !splitCommitted || !cashAmountValid}
        >
          Cash Success
        </button>
      </div>
    </div>
  );
}
