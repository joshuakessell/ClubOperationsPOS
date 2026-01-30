import { t, type Language } from '../../i18n';
import { KioskModal } from '../../views/KioskModal';
import { KioskModalActions } from '../../views/KioskModalActions';
import { Button } from '../ui/button';

export interface UpgradeDisclaimerModalProps {
  isOpen: boolean;
  customerPrimaryLanguage: Language | null | undefined;
  onClose: () => void;
  onAcknowledge: () => void;
  isSubmitting: boolean;
}

export function UpgradeDisclaimerModal({
  isOpen,
  customerPrimaryLanguage,
  onClose,
  onAcknowledge,
  isSubmitting,
}: UpgradeDisclaimerModalProps) {
  return (
    <KioskModal
      isOpen={isOpen}
      title={t(customerPrimaryLanguage, 'upgrade.title')}
      onClose={onClose}
    >
      <p>
        <strong>{t(customerPrimaryLanguage, 'upgrade.title')}</strong>
      </p>
      <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
        <li>{t(customerPrimaryLanguage, 'upgrade.bullet.feesApplyToRemaining')}</li>
        <li>{t(customerPrimaryLanguage, 'upgrade.bullet.noExtension')}</li>
        <li className="font-semibold text-rose-600">
          {t(customerPrimaryLanguage, 'upgrade.bullet.noRefunds')}
        </li>
        <li>{t(customerPrimaryLanguage, 'upgrade.bullet.chargedWhenAccepted')}</li>
      </ul>
      <KioskModalActions>
        <Button onClick={() => void onAcknowledge()} disabled={isSubmitting}>
          {t(customerPrimaryLanguage, 'common.ok')}
        </Button>
      </KioskModalActions>
    </KioskModal>
  );
}
