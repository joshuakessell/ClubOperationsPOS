import { t, type Language } from '../../i18n';
import { KioskModal } from '../../views/KioskModal';
import { KioskModalActions } from '../../views/KioskModalActions';
import { Button } from '../ui/button';

export interface RenewalDisclaimerModalProps {
  isOpen: boolean;
  customerPrimaryLanguage: Language | null | undefined;
  blockEndsAt?: string | null;
  onClose: () => void;
  onProceed: () => void;
  isSubmitting: boolean;
}

export function RenewalDisclaimerModal({
  isOpen,
  customerPrimaryLanguage,
  blockEndsAt,
  onClose,
  onProceed,
  isSubmitting,
}: RenewalDisclaimerModalProps) {
  return (
    <KioskModal
      isOpen={isOpen}
      title={t(customerPrimaryLanguage, 'renewal.title')}
      onClose={onClose}
    >
      <ul className="space-y-2 text-sm text-muted-foreground">
        <li>
          {t(customerPrimaryLanguage, 'renewal.bullet.extendsStay')}
          {blockEndsAt && (
            <span>
              {' '}
              {t(customerPrimaryLanguage, 'renewal.currentCheckout', {
                time: new Date(blockEndsAt).toLocaleString(),
              })}
            </span>
          )}
        </li>
        <li className="font-semibold text-amber-600">
          {t(customerPrimaryLanguage, 'renewal.bullet.approachingMax')}
        </li>
        <li>{t(customerPrimaryLanguage, 'renewal.bullet.finalExtension')}</li>
        <li>{t(customerPrimaryLanguage, 'renewal.bullet.feeNotChargedNow')}</li>
      </ul>
      <KioskModalActions>
        <Button onClick={() => void onProceed()} disabled={isSubmitting}>
          {t(customerPrimaryLanguage, 'common.ok')}
        </Button>
      </KioskModalActions>
    </KioskModal>
  );
}
