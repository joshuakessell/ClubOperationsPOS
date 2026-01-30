import { ReactNode } from 'react';
import { I18nProvider, t, type Language } from '../i18n';
import { ScreenShell } from '../components/ScreenShell';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { cn } from '../lib/utils';

export interface LanguageScreenProps {
  customerPrimaryLanguage: Language | null | undefined;
  onSelectLanguage: (lang: 'EN' | 'ES') => void;
  isSubmitting: boolean;
  highlightedLanguage?: 'EN' | 'ES' | null;
  orientationOverlay: ReactNode;
  welcomeOverlay: ReactNode;
}

export function LanguageScreen({
  customerPrimaryLanguage,
  onSelectLanguage,
  isSubmitting,
  highlightedLanguage = null,
  orientationOverlay,
  welcomeOverlay,
}: LanguageScreenProps) {
  return (
    <I18nProvider lang={customerPrimaryLanguage}>
      <ScreenShell title={t(customerPrimaryLanguage, 'selectLanguage')} activeNav="checkin">
        {orientationOverlay}
        {welcomeOverlay}
        <div className="mx-auto grid max-w-3xl gap-6">
          <Card className="p-8">
            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                {t(null, 'selectLanguage')}
              </p>
              <h2 className="mt-3 text-3xl font-semibold">{t(null, 'welcome')}</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {t(null, 'selectLanguage')}
              </p>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <Button
                className={cn(
                  'h-16 rounded-2xl text-lg',
                  highlightedLanguage === 'EN' ? 'ring-2 ring-primary/40' : ''
                )}
                onClick={() => void onSelectLanguage('EN')}
                disabled={isSubmitting}
              >
                {t(null, 'english')}
              </Button>
              <Button
                variant="secondary"
                className={cn(
                  'h-16 rounded-2xl text-lg',
                  highlightedLanguage === 'ES' ? 'ring-2 ring-primary/40' : ''
                )}
                onClick={() => void onSelectLanguage('ES')}
                disabled={isSubmitting}
              >
                {t(null, 'spanish')}
              </Button>
            </div>
          </Card>
        </div>
      </ScreenShell>
    </I18nProvider>
  );
}
