import { ReactNode } from 'react';
import { I18nProvider, t, type Language } from '../i18n';
import { ScreenShell } from '../components/ScreenShell';
import { Button } from '../ui/Button';

export interface LanguageScreenProps {
  customerPrimaryLanguage: Language | null | undefined;
  onSelectLanguage: (lang: 'EN' | 'ES') => void;
  isSubmitting: boolean;
  orientationOverlay: ReactNode;
  welcomeOverlay: ReactNode;
}

export function LanguageScreen({
  customerPrimaryLanguage,
  onSelectLanguage,
  isSubmitting,
  orientationOverlay,
  welcomeOverlay,
}: LanguageScreenProps) {
  return (
    <I18nProvider lang={customerPrimaryLanguage}>
      <ScreenShell backgroundVariant="steamroom1" showLogoWatermark={true} watermarkLayer="under">
        {orientationOverlay}
        {welcomeOverlay}
        <div className="active-content">
          <main className="main-content">
            <div className="language-selection-screen">
              <h1 className="language-title">{t(null, 'selectLanguage')}</h1>
              <div className="language-options">
                <Button
                  className="language-option"
                  onClick={() => void onSelectLanguage('EN')}
                  disabled={isSubmitting}
                >
                  {t(null, 'english')}
                </Button>
                <Button
                  className="language-option"
                  onClick={() => void onSelectLanguage('ES')}
                  disabled={isSubmitting}
                >
                  {t(null, 'spanish')}
                </Button>
              </div>
            </div>
          </main>
        </div>
      </ScreenShell>
    </I18nProvider>
  );
}

