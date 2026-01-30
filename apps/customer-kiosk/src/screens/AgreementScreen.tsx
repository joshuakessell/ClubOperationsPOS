import { ReactNode, RefObject, useEffect, useMemo, useState } from 'react';
import { I18nProvider, t, type Language } from '../i18n';
import { ScreenShell } from '../components/ScreenShell';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Checkbox } from '../components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';

export interface Agreement {
  id: string;
  version: string;
  title: string;
  bodyText: string;
}

export interface AgreementScreenProps {
  customerPrimaryLanguage: Language | null | undefined;
  agreement: Agreement | null;
  agreed: boolean;
  signatureData: string | null;
  hasScrolledAgreement: boolean;
  isSubmitting: boolean;
  orientationOverlay: ReactNode;
  welcomeOverlay: ReactNode;
  agreementScrollRef: RefObject<HTMLDivElement>;
  signatureCanvasRef: RefObject<HTMLCanvasElement>;
  onAgreeChange: (agreed: boolean) => void;
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
  agreed,
  signatureData,
  hasScrolledAgreement,
  isSubmitting,
  orientationOverlay,
  welcomeOverlay,
  agreementScrollRef,
  signatureCanvasRef,
  onAgreeChange,
  onSignatureStart,
  onSignatureMove,
  onSignatureEnd,
  onClearSignature,
  onSubmit,
}: AgreementScreenProps) {
  const [signatureModalOpen, setSignatureModalOpen] = useState(false);

  const pulseSignButton = useMemo(() => {
    if (isSubmitting) return false;
    if (!hasScrolledAgreement) return false;
    return agreed && !signatureData;
  }, [agreed, hasScrolledAgreement, isSubmitting, signatureData]);

  const pulseSubmitButton = useMemo(() => {
    if (isSubmitting) return false;
    if (!hasScrolledAgreement) return false;
    return agreed && Boolean(signatureData);
  }, [agreed, hasScrolledAgreement, isSubmitting, signatureData]);

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
      <ScreenShell title={t(customerPrimaryLanguage, 'agreementTitle')} activeNav="agreement">
        {orientationOverlay}
        {welcomeOverlay}
        <div className="mx-auto max-w-4xl space-y-6">
          <Card className="p-6">
            <h1 className="text-2xl font-semibold">
              {agreement?.title || t(customerPrimaryLanguage, 'agreementTitle')}
            </h1>

            <div className="mt-4 space-y-3">
              {!hasScrolledAgreement && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
                  {t(customerPrimaryLanguage, 'agreement.readAndScrollToContinue')}
                </div>
              )}

              <div className="rounded-2xl border border-border bg-white/70 p-4">
                <div
                  ref={agreementScrollRef}
                  className="max-h-[320px] overflow-y-auto pr-3 text-sm leading-relaxed text-slate-700"
                >
                  {agreement?.bodyText ? (
                    <div
                      className="text-sm leading-relaxed text-slate-700 [&_p]:mt-3 [&_p:first-child]:mt-0 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mt-2"
                      dangerouslySetInnerHTML={{ __html: agreement.bodyText }}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {t(customerPrimaryLanguage, 'agreementPlaceholder')}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <div className="flex items-center gap-3 rounded-2xl border border-border bg-muted/50 px-4 py-3">
                <Checkbox
                  checked={agreed}
                  onCheckedChange={(checked) => onAgreeChange(Boolean(checked))}
                  disabled={!hasScrolledAgreement}
                />
                <span className="text-sm font-medium">{t(customerPrimaryLanguage, 'iAgree')}</span>
              </div>

              {!hasScrolledAgreement && (
                <p className="text-xs text-muted-foreground">
                  {t(customerPrimaryLanguage, 'scrollRequired')}
                </p>
              )}

              {hasScrolledAgreement && !agreed && (
                <p className="text-xs text-muted-foreground">
                  {t(customerPrimaryLanguage, 'agreement.pleaseCheckToContinue')}
                </p>
              )}

              <Button
                type="button"
                variant="secondary"
                className={`w-full rounded-2xl ${pulseSignButton ? 'animate-pulse-soft' : ''}`}
                onClick={() => setSignatureModalOpen(true)}
                disabled={!hasScrolledAgreement || !!signatureData}
              >
                {signatureData ? t(customerPrimaryLanguage, 'agreement.signed') : t(customerPrimaryLanguage, 'agreement.tapToSign')}
              </Button>

              <Button
                className={`w-full rounded-2xl text-base ${pulseSubmitButton ? 'animate-pulse-soft' : ''}`}
                onClick={onSubmit}
                disabled={!agreed || !signatureData || !hasScrolledAgreement || isSubmitting}
              >
                {isSubmitting ? t(customerPrimaryLanguage, 'submitting') : t(customerPrimaryLanguage, 'submit')}
              </Button>
            </div>
          </Card>
        </div>

        <Dialog open={signatureModalOpen} onOpenChange={setSignatureModalOpen}>
          <DialogContent aria-label={t(customerPrimaryLanguage, 'a11y.signatureDialog')}>
            <DialogHeader>
              <DialogTitle>{t(customerPrimaryLanguage, 'signatureRequired')}</DialogTitle>
            </DialogHeader>
            <div className="mt-3 rounded-2xl border border-border bg-white p-3">
              <canvas
                ref={signatureCanvasRef}
                className="h-64 w-full touch-none rounded-xl border border-dashed border-border"
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
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  onClearSignature();
                  setSignatureModalOpen(false);
                }}
              >
                {t(customerPrimaryLanguage, 'common.cancel')}
              </Button>
              <Button
                type="button"
                disabled={!signatureData}
                onClick={() => setSignatureModalOpen(false)}
              >
                {t(customerPrimaryLanguage, 'agreement.sign')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </ScreenShell>
    </I18nProvider>
  );
}
