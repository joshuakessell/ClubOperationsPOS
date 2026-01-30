import { t, type Language } from '../../i18n';
import { KioskModal } from '../../views/KioskModal';
import { KioskModalActions } from '../../views/KioskModalActions';
import { Button } from '../ui/button';

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
        <Button onClick={() => void onContinue()} disabled={isSubmitting}>
          {t(customerPrimaryLanguage, 'common.continue')}
        </Button>
        <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
          {t(customerPrimaryLanguage, 'common.cancel')}
        </Button>
      </KioskModalActions>
    </KioskModal>
  );
}
