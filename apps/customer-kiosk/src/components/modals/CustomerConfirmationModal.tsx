import { t, type Language } from '../../i18n';
import { getRentalDisplayName } from '../../utils/display';
import type { CustomerConfirmationRequiredPayload } from '@club-ops/shared';
import { KioskModal } from '../../views/KioskModal';
import { KioskModalActions } from '../../views/KioskModalActions';

export interface CustomerConfirmationModalProps {
  isOpen: boolean;
  customerPrimaryLanguage: Language | null | undefined;
  data: CustomerConfirmationRequiredPayload;
  onAccept: () => void;
  onDecline: () => void;
  isSubmitting: boolean;
}

export function CustomerConfirmationModal({
  isOpen,
  customerPrimaryLanguage,
  data,
  onAccept,
  onDecline,
  isSubmitting,
}: CustomerConfirmationModalProps) {
  return (
    <KioskModal
      isOpen={isOpen}
      title={t(customerPrimaryLanguage, 'confirmDifferent.title')}
      closeOnOverlayClick={false}
    >
      <p>
        {t(customerPrimaryLanguage, 'confirmDifferent.youRequested')}{' '}
        <strong>{getRentalDisplayName(data.requestedType, customerPrimaryLanguage)}</strong>
      </p>
      <p>
        {t(customerPrimaryLanguage, 'confirmDifferent.staffSelected')}{' '}
        <strong>
          {getRentalDisplayName(data.selectedType, customerPrimaryLanguage)} {data.selectedNumber}
        </strong>
      </p>
      <p>{t(customerPrimaryLanguage, 'confirmDifferent.question')}</p>
      <KioskModalActions>
        <button
          className="rounded-lg bg-brand-500 px-6 py-3 font-semibold text-white transition hover:bg-brand-600 disabled:opacity-50"
          onClick={() => void onAccept()}
          disabled={isSubmitting}
        >
          {t(customerPrimaryLanguage, 'common.accept')}
        </button>
        <button
          className="rounded-lg border border-red-500/40 bg-red-500/10 px-6 py-3 font-semibold text-red-400 transition hover:bg-red-500/20 disabled:opacity-50"
          onClick={() => void onDecline()}
          disabled={isSubmitting}
        >
          {t(customerPrimaryLanguage, 'common.decline')}
        </button>
      </KioskModalActions>
    </KioskModal>
  );
}
