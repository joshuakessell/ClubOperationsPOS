import { getErrorMessage, isRecord } from '@club-ops/ui';
import { t } from '../../i18n';
import type { SelectionFlowCallbacks, SelectionFlowNotices, SelectionFlowSetters, SelectionFlowState, SelectionFlowUi } from './types';

type MembershipActionParams = {
  apiBase: string;
  kioskAuthHeaders: (extra?: Record<string, string>) => Record<string, string>;
  state: Pick<SelectionFlowState, 'session' | 'lane' | 'membershipModalIntent'>;
  setters: Pick<
    SelectionFlowSetters,
    | 'setSession'
    | 'setMembershipChoice'
    | 'setShowMembershipModal'
    | 'setMembershipModalIntent'
  >;
  ui: Pick<SelectionFlowUi, 'setIsSubmitting'>;
  callbacks: SelectionFlowCallbacks;
  notices: SelectionFlowNotices;
};

export function createMembershipFlowActions({
  apiBase,
  kioskAuthHeaders,
  state,
  setters,
  ui,
  callbacks,
  notices,
}: MembershipActionParams) {
  const { session, lane, membershipModalIntent } = state;
  const { setIsSubmitting } = ui;
  const { onSwitchToLanguage } = callbacks;
  const { showNotice } = notices;

  const handleClearMembershipPurchaseIntent = async () => {
    if (!session.sessionId) return;
    if (!lane) return;
    const lang = session.customerPrimaryLanguage;
    setIsSubmitting(true);
    try {
      const response = await fetch(
        `${apiBase}/v1/checkin/lane/${lane}/membership-purchase-intent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...kioskAuthHeaders() },
          body: JSON.stringify({ intent: 'NONE', sessionId: session.sessionId }),
        }
      );
      if (!response.ok) {
        const errorPayload: unknown = await response.json().catch(() => null);
        if (
          response.status === 409 &&
          isRecord(errorPayload) &&
          errorPayload.code === 'LANGUAGE_REQUIRED'
        ) {
          onSwitchToLanguage();
          showNotice({ tone: 'warning', title: t('EN', 'selectLanguage') });
          return;
        }
        throw new Error(getErrorMessage(errorPayload) || 'Failed to clear membership intent');
      }
      setters.setSession((prev) => ({ ...prev, membershipPurchaseIntent: null }));
    } catch (error) {
      console.error('Failed to clear membership purchase intent:', error);
      showNotice({
        tone: 'warning',
        title: error instanceof Error ? error.message : t(lang, 'error.process'),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectOneTimeMembership = async () => {
    setters.setMembershipChoice('ONE_TIME');
    if (session.membershipPurchaseIntent) {
      await handleClearMembershipPurchaseIntent();
    }
    if (session.sessionId) {
      if (!lane) return;
      try {
        const response = await fetch(`${apiBase}/v1/checkin/lane/${lane}/membership-choice`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...kioskAuthHeaders() },
          body: JSON.stringify({ choice: 'ONE_TIME', sessionId: session.sessionId }),
        });
        if (!response.ok && response.status === 409) {
          const errorPayload: unknown = await response.json().catch(() => null);
          if (isRecord(errorPayload) && errorPayload.code === 'LANGUAGE_REQUIRED') {
            onSwitchToLanguage();
            showNotice({ tone: 'warning', title: t('EN', 'selectLanguage') });
          }
        }
      } catch {
        // Best-effort (UI still works locally).
      }
    }
  };

  const handleMembershipContinue = async () => {
    if (!membershipModalIntent || !session.sessionId) return;
    if (!lane) return;
    const lang = session.customerPrimaryLanguage;
    setIsSubmitting(true);
    try {
      const response = await fetch(
        `${apiBase}/v1/checkin/lane/${lane}/membership-purchase-intent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...kioskAuthHeaders() },
          body: JSON.stringify({ intent: membershipModalIntent, sessionId: session.sessionId }),
        }
      );
      if (!response.ok) {
        const errorPayload: unknown = await response.json().catch(() => null);
        if (
          response.status === 409 &&
          isRecord(errorPayload) &&
          errorPayload.code === 'LANGUAGE_REQUIRED'
        ) {
          onSwitchToLanguage();
          showNotice({ tone: 'warning', title: t('EN', 'selectLanguage') });
          return;
        }
        throw new Error(getErrorMessage(errorPayload) || 'Failed to request membership purchase');
      }
      setters.setSession((prev) => ({ ...prev, membershipPurchaseIntent: membershipModalIntent }));
      setters.setMembershipChoice('SIX_MONTH');
      setters.setShowMembershipModal(false);
      setters.setMembershipModalIntent(null);
    } catch (error) {
      console.error('Failed to set membership purchase intent:', error);
      showNotice({
        tone: 'warning',
        title: error instanceof Error ? error.message : t(lang, 'error.process'),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    handleClearMembershipPurchaseIntent,
    handleSelectOneTimeMembership,
    handleMembershipContinue,
  };
}
