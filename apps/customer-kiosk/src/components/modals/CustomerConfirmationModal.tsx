import { t, type Language } from '../../i18n';
import { getRentalDisplayName } from '../../utils/display';
import type { CustomerConfirmationRequiredPayload } from '@club-ops/shared';
import { KioskModal } from '../../views/KioskModal';
import { KioskModalActions } from '../../views/KioskModalActions';
import { Button } from '../ui/button';

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
        <Button onClick={() => void onAccept()} disabled={isSubmitting}>
          {t(customerPrimaryLanguage, 'common.accept')}
        </Button>
        <Button
          variant="destructive"
          onClick={() => void onDecline()}
          disabled={isSubmitting}
        >
          {t(customerPrimaryLanguage, 'common.decline')}
        </Button>
      </KioskModalActions>
    </KioskModal>
  );
}
