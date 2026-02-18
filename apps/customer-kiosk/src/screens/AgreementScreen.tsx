import { ReactNode, useEffect, useMemo, useState } from 'react';
import { I18nProvider, t, type Language } from '../i18n';
import { ScreenShell } from '../components/ScreenShell';
import { KioskNoticeBanner } from '../views/KioskNoticeBanner';
import type { KioskNotice } from '../app/notice';

export interface Agreement {
  id: string;
  version: string;
  title: string;
  bodyText: string;
}

export interface AgreementScreenProps {
  customerPrimaryLanguage: Language | null | undefined;
  agreement: Agreement | null;
  signatureData: string | null;
  isSubmitting: boolean;
  orientationOverlay: ReactNode;
  welcomeOverlay: ReactNode;
  notice?: KioskNotice | null;
  signatureCanvasRef: React.RefObject<HTMLCanvasElement>;
  onSignatureStart: (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => void;
  onSignatureMove: (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => void;
  onSignatureEnd: () => void;
  onClearSignature: () => void;
  onSubmit: () => void;
}

export function AgreementScreen({
  customerPrimaryLanguage,
  agreement,
  signatureData,
  isSubmitting,
  orientationOverlay,
  welcomeOverlay,
  notice,
  signatureCanvasRef,
  onSignatureStart,
  onSignatureMove,
  onSignatureEnd,
  onClearSignature,
  onSubmit,
}: AgreementScreenProps) {
  const [signatureModalOpen, setSignatureModalOpen] = useState(false);

  const pulseSignButton = useMemo(() => {
    if (isSubmitting) return false;
    return !signatureData;
  }, [isSubmitting, signatureData]);

  const pulseSubmitButton = useMemo(() => {
    if (isSubmitting) return false;
    return Boolean(signatureData);
  }, [isSubmitting, signatureData]);

  useEffect(() => {
    if (!signatureModalOpen) return;
    // Ensure a clean canvas each time the signature modal opens.
    // (Canvas mounts only when modal is open.)
    onClearSignature();
    // Intentionally *not* dependent on onClearSignature: the parent recreates handlers on each render,
    // and including it here would clear the canvas immediately after signatureData updates while
    // the modal is still open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signatureModalOpen]);

  return (
    <I18nProvider lang={customerPrimaryLanguage}>
      <ScreenShell backgroundVariant="none" showLogoWatermark={false}>
        {orientationOverlay}
        {welcomeOverlay}
        <div className="agreement-screen-container">
          {/* Card panel */}
          <div className="agreement-paper-panel rounded-2xl border border-gray-700 bg-gray-800/80 shadow-lg backdrop-blur-sm">
            <h1 className="agreement-title">
              {agreement?.title || t(customerPrimaryLanguage, 'agreementTitle')}
            </h1>
            {notice && (
              <KioskNoticeBanner tone={notice.tone ?? 'warning'} title={notice.title}>
                {notice.message}
              </KioskNoticeBanner>
            )}

            {/* Scroll region (must flex) */}
            <div className="ck-agreement-scroll-region">
              <div className="agreement-scroll-wrap">
                <div className="agreement-scroll-area agreement-scroll-area--static">
                  {agreement?.bodyText ? (
                    <div
                      className="agreement-body"
                      dangerouslySetInnerHTML={{ __html: agreement.bodyText }}
                    />
                  ) : (
                    <p className="agreement-placeholder">
                      {t(customerPrimaryLanguage, 'agreementPlaceholder')}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="agreement-actions">
              {/* Signature step */}
              <div className="ck-action-row">
                <div className="ck-action-indicator" aria-hidden="true">
                  {/* intentionally empty */}
                </div>
                <div className="ck-action-content ck-action-content--center">
                  <button
                    type="button"
                    className={[
                      'rounded-lg bg-brand-500 px-6 py-3 font-semibold text-white transition hover:bg-brand-600 disabled:opacity-50',
                      'agreement-signature-button',
                      pulseSignButton ? 'pulse-bright' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => setSignatureModalOpen(true)}
                    disabled={!!signatureData}
                  >
                    {signatureData ? (
                      <span className="agreement-signature-button__content">
                        <span className="agreement-signature-check" aria-hidden="true">
                          ✓
                        </span>
                        <span>{t(customerPrimaryLanguage, 'agreement.signed')}</span>
                      </span>
                    ) : (
                      t(customerPrimaryLanguage, 'agreement.tapToSign')
                    )}
                  </button>
                </div>
              </div>

              <div className="agreement-submit-container">
                <button
                    className={[
                      'rounded-lg bg-green-600 px-8 py-4 text-lg font-semibold text-white transition hover:bg-green-700 disabled:opacity-50',
                      'submit-agreement-btn',
                      pulseSubmitButton ? 'pulse-bright' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  onClick={onSubmit}
                  disabled={!signatureData || isSubmitting}
                >
                  {isSubmitting
                    ? t(customerPrimaryLanguage, 'submitting')
                    : t(customerPrimaryLanguage, 'submit')}
                </button>
              </div>
            </div>
          </div>
        </div>

        {signatureModalOpen && (
          <div
            className="signature-modal-overlay"
            role="dialog"
            aria-label={t(customerPrimaryLanguage, 'a11y.signatureDialog')}
          >
            <div className="signature-modal rounded-2xl border border-gray-700 bg-gray-900 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="signature-modal-header">
                <div className="signature-modal-title">
                  {t(customerPrimaryLanguage, 'signatureRequired')}
                </div>
              </div>

              <canvas
                ref={signatureCanvasRef}
                className="signature-modal-canvas"
                width={900}
                height={320}
                onMouseDown={onSignatureStart}
                onMouseMove={onSignatureMove}
                onMouseUp={onSignatureEnd}
                onMouseLeave={onSignatureEnd}
                onTouchStart={onSignatureStart}
                onTouchMove={onSignatureMove}
                onTouchEnd={onSignatureEnd}
              />

              <div className="signature-modal-actions">
                <button
                  type="button"
                  className="rounded-lg border border-gray-600 bg-gray-800 px-6 py-3 font-semibold text-gray-300 transition hover:bg-gray-700"
                  onClick={() => {
                    onClearSignature();
                    setSignatureModalOpen(false);
                  }}
                >
                  {t(customerPrimaryLanguage, 'common.cancel')}
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-brand-500 px-6 py-3 font-semibold text-white transition hover:bg-brand-600 disabled:opacity-50"
                  disabled={!signatureData}
                  onClick={() => setSignatureModalOpen(false)}
                >
                  {t(customerPrimaryLanguage, 'agreement.sign')}
                </button>
              </div>
            </div>
          </div>
        )}
      </ScreenShell>
    </I18nProvider>
  );
}
