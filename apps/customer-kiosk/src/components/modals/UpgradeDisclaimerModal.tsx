import { t, type Language } from '../../i18n';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';

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
    <Modal open={isOpen} onClose={onClose} title={t(customerPrimaryLanguage, 'upgrade.title')} width="2xl">
      <div className="grid gap-6">
        <div className="text-left">
          <ul className="list-disc space-y-3 pl-6 text-lg text-gray-700">
            <li>{t(customerPrimaryLanguage, 'upgrade.bullet.feesApplyToRemaining')}</li>
            <li>{t(customerPrimaryLanguage, 'upgrade.bullet.noExtension')}</li>
            <li className="font-semibold text-red-600">{t(customerPrimaryLanguage, 'upgrade.bullet.noRefunds')}</li>
            <li>{t(customerPrimaryLanguage, 'upgrade.bullet.chargedWhenAccepted')}</li>
          </ul>
        </div>
        <div className="flex justify-center">
          <Button onClick={() => void onAcknowledge()} disabled={isSubmitting} className="min-w-[240px]">
            {t(customerPrimaryLanguage, 'common.ok')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

