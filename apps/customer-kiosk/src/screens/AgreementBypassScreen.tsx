import { ReactNode } from 'react';
import { I18nProvider, t, type Language } from '../i18n';
import { ScreenShell } from '../components/ScreenShell';
import { KioskMessageCard } from '../views/KioskMessageCard';

export interface AgreementBypassScreenProps {
  customerPrimaryLanguage: Language | null | undefined;
  orientationOverlay: ReactNode;
  welcomeOverlay: ReactNode;
}

export function AgreementBypassScreen({
  customerPrimaryLanguage,
  orientationOverlay,
  welcomeOverlay,
}: AgreementBypassScreenProps) {
  return (
    <I18nProvider lang={customerPrimaryLanguage}>
      <ScreenShell title={t(customerPrimaryLanguage, 'agreementTitle')} activeNav="agreement">
        {orientationOverlay}
        {welcomeOverlay}
        <div className="mx-auto max-w-2xl">
          <KioskMessageCard
            title={t(customerPrimaryLanguage, 'agreementTitle')}
            body={t(customerPrimaryLanguage, 'agreement.bypassMessage')}
          />
        </div>
      </ScreenShell>
    </I18nProvider>
  );
}
