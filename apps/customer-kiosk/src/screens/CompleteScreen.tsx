import { ReactNode } from 'react';
import { I18nProvider, t, type Language } from '../i18n';
import { ScreenShell } from '../components/ScreenShell';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';

export interface CompleteScreenProps {
  customerPrimaryLanguage: Language | null | undefined;
  assignedResourceType?: 'room' | 'locker';
  assignedResourceNumber?: string;
  checkoutAt?: string;
  isSubmitting: boolean;
  onAcknowledge: () => void;
  orientationOverlay: ReactNode;
  welcomeOverlay: ReactNode;
}

export function CompleteScreen({
  customerPrimaryLanguage,
  assignedResourceType,
  assignedResourceNumber,
  checkoutAt,
  isSubmitting,
  onAcknowledge,
  orientationOverlay,
  welcomeOverlay,
}: CompleteScreenProps) {
  const lang = customerPrimaryLanguage;
  const locale = lang ?? undefined;

  const checkoutDate = checkoutAt ? new Date(checkoutAt) : null;
  const hasValidCheckoutDate = checkoutDate != null && !Number.isNaN(checkoutDate.getTime());
  const checkoutTimeText = hasValidCheckoutDate
    ? checkoutDate.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' })
    : null;
  const checkoutDateText = hasValidCheckoutDate
    ? checkoutDate.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' })
    : null;

  return (
    <I18nProvider lang={lang}>
      <ScreenShell title={t(lang, 'complete')} activeNav="complete">
        {orientationOverlay}
        {welcomeOverlay}
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 text-center">
          {assignedResourceType && assignedResourceNumber ? (
            <Card className="w-full p-6 text-left">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  {t(lang, assignedResourceType)}
                </div>
                <div className="text-4xl font-semibold">{assignedResourceNumber}</div>
              </div>

              {checkoutAt && (
                <div className="mt-4 rounded-2xl border border-border bg-muted/50 px-4 py-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    {t(lang, 'checkoutAt')}
                  </div>
                  <div className="mt-1 text-lg font-semibold">
                    {checkoutTimeText ?? new Date(checkoutAt).toLocaleString(locale)}
                  </div>
                  {checkoutDateText && (
                    <div className="text-sm text-muted-foreground">{checkoutDateText}</div>
                  )}
                </div>
              )}
            </Card>
          ) : (
            <Card className="w-full p-6">
              <p className="text-lg font-semibold">{t(lang, 'assignmentComplete')}</p>
            </Card>
          )}

          <Button
            type="button"
            className="w-40 rounded-2xl text-lg"
            onClick={onAcknowledge}
            disabled={isSubmitting}
          >
            OK
          </Button>
        </div>
      </ScreenShell>
    </I18nProvider>
  );
}
