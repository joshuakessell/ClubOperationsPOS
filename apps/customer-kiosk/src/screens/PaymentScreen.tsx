import { ReactNode } from 'react';
import { I18nProvider, t, type Language } from '../i18n';
import { ScreenShell } from '../components/ScreenShell';
import { getPaymentLineItemDisplayDescription } from '../utils/display';
import { Card } from '../components/ui/card';

export interface PaymentScreenProps {
  customerPrimaryLanguage: Language | null | undefined;
  paymentLineItems?: Array<{ description: string; amount: number }>;
  paymentTotal?: number;
  paymentFailureReason?: string;
  orientationOverlay: ReactNode;
  welcomeOverlay: ReactNode;
}

export function PaymentScreen({
  customerPrimaryLanguage,
  paymentLineItems,
  paymentTotal,
  paymentFailureReason,
  orientationOverlay,
  welcomeOverlay,
}: PaymentScreenProps) {
  const formatAmount = (amount: number) => {
    const abs = Math.abs(amount);
    const sign = amount < 0 ? '-' : '';
    return `${sign}$${abs.toFixed(2)}`;
  };

  return (
    <I18nProvider lang={customerPrimaryLanguage}>
      <ScreenShell title={t(customerPrimaryLanguage, 'payment.title')} activeNav="payment">
        {orientationOverlay}
        {welcomeOverlay}
        <div className="mx-auto grid max-w-4xl gap-6">
          {paymentLineItems && paymentLineItems.length > 0 && (
            <Card className="p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                {t(customerPrimaryLanguage, 'payment.charges')}
              </p>
              <div className="mt-4 space-y-3">
                {paymentLineItems.map((li, idx) => (
                  <div
                    key={`${li.description}-${idx}`}
                    className="flex items-center justify-between text-sm font-medium"
                  >
                    <span className="text-muted-foreground">
                      {getPaymentLineItemDisplayDescription(
                        li.description,
                        customerPrimaryLanguage
                      )}
                    </span>
                    <span className="text-foreground">{formatAmount(li.amount)}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
          {paymentTotal !== undefined && (
            <Card className="p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                {t(customerPrimaryLanguage, 'totalDue')}
              </p>
              <p className="mt-3 text-4xl font-semibold">${paymentTotal.toFixed(2)}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {t(customerPrimaryLanguage, 'paymentPending')}
              </p>
            </Card>
          )}
          {paymentFailureReason && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm font-semibold text-rose-700">
              {t(customerPrimaryLanguage, 'paymentIssueSeeAttendant')}
            </div>
          )}
        </div>
      </ScreenShell>
    </I18nProvider>
  );
}
