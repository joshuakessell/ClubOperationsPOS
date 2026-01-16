import { ReactNode } from 'react';
import { I18nProvider, t, type Language } from '../i18n';
import { ScreenShell } from '../components/ScreenShell';
import { Card } from '../ui/Card';

export interface IdleScreenProps {
  sessionId: string | null;
  kioskAcknowledgedAt: string | null | undefined;
  customerPrimaryLanguage: Language | null | undefined;
  orientationOverlay: ReactNode;
}

export function IdleScreen({
  sessionId,
  kioskAcknowledgedAt,
  customerPrimaryLanguage,
  orientationOverlay,
}: IdleScreenProps) {
  const lang = customerPrimaryLanguage;
  const locked = !!sessionId && !!kioskAcknowledgedAt;
  return (
    <I18nProvider lang={customerPrimaryLanguage}>
      <ScreenShell backgroundVariant="steamroom1" showLogoWatermark={true} watermarkLayer="under">
        {orientationOverlay}
        <div className="idle-content" onClick={() => locked && alert(t(lang, 'kiosk.locked.body'))}>
          {locked && (
            <Card className="mt-8 max-w-[720px] bg-slate-900/70 ring-slate-700 text-center text-white">
              <div className="text-2xl font-extrabold">{t(lang, 'kiosk.locked.title')}</div>
              <div className="mt-2 text-lg opacity-90">{t(lang, 'kiosk.locked.body')}</div>
            </Card>
          )}
        </div>
      </ScreenShell>
    </I18nProvider>
  );
}

