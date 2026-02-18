import { t, type Language } from '../../i18n';
import { KioskModal } from '../../views/KioskModal';
import { KioskModalActions } from '../../views/KioskModalActions';

export interface MembershipModalProps {
  isOpen: boolean;
  customerPrimaryLanguage: Language | null | undefined;
  intent: 'PURCHASE' | 'RENEW';
  onContinue: () => void;
  onClose: () => void;
  isSubmitting: boolean;
}

export function MembershipModal({
  isOpen,
  customerPrimaryLanguage,
  intent,
  onContinue,
  onClose,
  isSubmitting,
}: MembershipModalProps) {
  return (
    <KioskModal
      isOpen={isOpen}
      title={t(customerPrimaryLanguage, 'membership.modal.title')}
      onClose={onClose}
    >
      <p>
        {intent === 'PURCHASE'
          ? t(customerPrimaryLanguage, 'membership.modal.body.purchase')
          : t(customerPrimaryLanguage, 'membership.modal.body.renew')}
      </p>
      <KioskModalActions>
        <button
          className="rounded-lg bg-brand-500 px-6 py-3 font-semibold text-white transition hover:bg-brand-600 disabled:opacity-50"
          onClick={() => void onContinue()}
          disabled={isSubmitting}
        >
          {t(customerPrimaryLanguage, 'common.continue')}
        </button>
        <button
          className="rounded-lg border border-gray-600 bg-gray-800 px-6 py-3 font-semibold text-gray-300 transition hover:bg-gray-700 disabled:opacity-50"
          onClick={onClose}
          disabled={isSubmitting}
        >
          {t(customerPrimaryLanguage, 'common.cancel')}
        </button>
      </KioskModalActions>
    </KioskModal>
  );
}
