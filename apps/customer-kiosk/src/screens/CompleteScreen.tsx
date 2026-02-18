import { ReactNode } from 'react';
import { I18nProvider, t, type Language } from '../i18n';
import { ScreenShell } from '../components/ScreenShell';

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
      <ScreenShell backgroundVariant="steamroom1" showLogoWatermark={true}>
        {orientationOverlay}
        {welcomeOverlay}
        <div className="active-content">
          <main className="main-content">
            <div className="complete-screen">
              {assignedResourceType && assignedResourceNumber ? (
                <>
                  <div className="assignment-info rounded-2xl border border-gray-700 bg-gray-800/80 p-6 shadow-lg backdrop-blur-sm">
                    <div className="assignment-row">
                      <div className="assignment-label">{t(lang, assignedResourceType)}</div>
                      <div className="assignment-value">{assignedResourceNumber}</div>
                    </div>

                    {checkoutAt && (
                      <div className="assignment-row assignment-row--checkout">
                        <div className="assignment-label">{t(lang, 'checkoutAt')}</div>
                        <div className="assignment-value assignment-value--time">
                          {checkoutTimeText ?? new Date(checkoutAt).toLocaleString(locale)}
                        </div>
                        {checkoutDateText && (
                          <div className="assignment-subvalue">{checkoutDateText}</div>
                        )}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    className={[
                      'rounded-lg bg-brand-500 px-8 py-4 text-lg font-semibold text-white transition hover:bg-brand-600',
                      'complete-ok-btn',
                      isSubmitting ? 'opacity-50 cursor-not-allowed' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={onAcknowledge}
                    disabled={isSubmitting}
                  >
                    OK
                  </button>
                </>
              ) : (
                <>
                  <p>{t(lang, 'assignmentComplete')}</p>
                  <button
                    type="button"
                    className={[
                      'rounded-lg bg-brand-500 px-8 py-4 text-lg font-semibold text-white transition hover:bg-brand-600',
                      'complete-ok-btn',
                      isSubmitting ? 'opacity-50 cursor-not-allowed' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={onAcknowledge}
                    disabled={isSubmitting}
                  >
                    OK
                  </button>
                </>
              )}
            </div>
          </main>
        </div>
      </ScreenShell>
    </I18nProvider>
  );
}
