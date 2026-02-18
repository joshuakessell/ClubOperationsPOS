import { t, type Language } from '../../i18n';
import { KioskModal } from '../../views/KioskModal';
import { KioskModalActions } from '../../views/KioskModalActions';

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
      <ul className="my-4 list-disc space-y-3 pl-6 text-gray-300">
        <li>{t(customerPrimaryLanguage, 'upgrade.bullet.feesApplyToRemaining')}</li>
        <li>{t(customerPrimaryLanguage, 'upgrade.bullet.noExtension')}</li>
        <li className="font-semibold text-red-400">
          {t(customerPrimaryLanguage, 'upgrade.bullet.noRefunds')}
        </li>
        <li>{t(customerPrimaryLanguage, 'upgrade.bullet.chargedWhenAccepted')}</li>
      </ul>
      <KioskModalActions>
        <button
          className="rounded-lg bg-brand-500 px-6 py-3 font-semibold text-white transition hover:bg-brand-600 disabled:opacity-50"
          onClick={() => void onAcknowledge()}
          disabled={isSubmitting}
        >
          {t(customerPrimaryLanguage, 'common.ok')}
        </button>
      </KioskModalActions>
    </KioskModal>
  );
}
