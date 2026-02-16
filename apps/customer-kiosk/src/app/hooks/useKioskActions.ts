import { useCallback } from 'react';
import type { Language } from '../../i18n';
import { t } from '../../i18n';
import type { SessionState } from '../../utils/membership';
import type { KioskNotice } from '../notice';
import { generateUUID } from '../../utils/uuid';

type KioskAuthHeaders = (extra?: Record<string, string>) => Record<string, string>;

function isFlowCommandsEnabled(): boolean {
  return import.meta.env.VITE_FLOW_COMMANDS === '1';
}

export function useKioskActions({
  apiBase,
  lane,
  kioskAuthHeaders,
  session,
  isSubmitting,
  setIsSubmitting,
  setView,
  resetToIdle,
  showNotice,
  enqueue,
}: {
  apiBase: string;
  lane: string | null;
  kioskAuthHeaders: KioskAuthHeaders;
  session: SessionState;
  isSubmitting: boolean;
  setIsSubmitting: (value: boolean) => void;
  setView: (
    view:
      | 'idle'
      | 'selection'
      | 'payment'
      | 'agreement'
      | 'agreement-bypass'
      | 'complete'
  ) => void;
  resetToIdle: () => void;
  showNotice: (notice: KioskNotice, ttlMs?: number) => void;
  enqueue: (
    url: string,
    options: {
      method?: string;
      headers?: Record<string, string>;
      body?: string;
    }
  ) => Promise<void>;
}) {
  const handleLanguageSelection = useCallback(
    async (language: Language) => {
      if (!session.sessionId) {
        return;
      }
      if (!lane) return;

      setIsSubmitting(true);
      try {
        await enqueue(`${apiBase}/v1/checkin/lane/${lane}/set-language`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...kioskAuthHeaders(),
          },
          body: JSON.stringify({
            language,
            sessionId: session.sessionId,
            customerName: session.customerName || undefined,
          }),
        });
      } catch (error) {
        console.error('Failed to set language:', error);
        showNotice({
          tone: 'warning',
          title: t(session.customerPrimaryLanguage, 'error.setLanguage'),
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [apiBase, kioskAuthHeaders, lane, session, setIsSubmitting, showNotice, enqueue]
  );

  const handleKioskAcknowledge = useCallback(async () => {
    if (!lane) return;
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      await enqueue(`${apiBase}/v1/checkin/lane/${lane}/kiosk-ack`, {
        method: 'POST',
        headers: kioskAuthHeaders(),
      });

      setView('idle');
    } catch (error) {
      console.error('Failed to acknowledge completion:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [apiBase, isSubmitting, kioskAuthHeaders, lane, setIsSubmitting, setView, enqueue]);

  const handleIdScanIssueDismiss = useCallback(async () => {
    if (!lane) return;
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await enqueue(`${apiBase}/v1/checkin/lane/${lane}/reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...kioskAuthHeaders(),
        },
      });

      resetToIdle();
    } catch (error) {
      console.error('Failed to reset after ID scan issue:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [apiBase, isSubmitting, kioskAuthHeaders, lane, resetToIdle, setIsSubmitting, enqueue]);

  const handleBack = useCallback(async () => {
    if (!lane) return;
    if (!session.sessionId) return;
    if (typeof session.flowVersion !== 'number') return;
    if (!isFlowCommandsEnabled()) return;

    setIsSubmitting(true);
    try {
      await enqueue(`${apiBase}/v1/checkin/lane/${lane}/flow-command`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...kioskAuthHeaders(),
        },
        body: JSON.stringify({
          sessionId: session.sessionId,
          commandId: generateUUID(),
          actor: 'CUSTOMER',
          expectedFlowVersion: session.flowVersion,
          type: 'BACK_STEP',
        }),
      });
    } catch (error) {
      console.error('Failed to navigate back:', error);
      showNotice({ tone: 'warning', title: t(session.customerPrimaryLanguage, 'error.generic') });
    } finally {
      setIsSubmitting(false);
    }
  }, [apiBase, kioskAuthHeaders, lane, session.customerPrimaryLanguage, session.flowVersion, session.sessionId, setIsSubmitting, showNotice, enqueue]);

  const handleCancel = useCallback(async () => {
    if (!lane) return;
    if (!session.sessionId) return;
    if (typeof session.flowVersion !== 'number') return;
    if (!isFlowCommandsEnabled()) return;

    setIsSubmitting(true);
    try {
      await enqueue(`${apiBase}/v1/checkin/lane/${lane}/flow-command`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...kioskAuthHeaders(),
        },
        body: JSON.stringify({
          sessionId: session.sessionId,
          commandId: generateUUID(),
          actor: 'CUSTOMER',
          expectedFlowVersion: session.flowVersion,
          type: 'CANCEL_STEP',
        }),
      });
    } catch (error) {
      console.error('Failed to cancel step:', error);
      showNotice({ tone: 'warning', title: t(session.customerPrimaryLanguage, 'error.generic') });
    } finally {
      setIsSubmitting(false);
    }
  }, [apiBase, kioskAuthHeaders, lane, session.customerPrimaryLanguage, session.flowVersion, session.sessionId, setIsSubmitting, showNotice, enqueue]);

  return { handleLanguageSelection, handleKioskAcknowledge, handleIdScanIssueDismiss, handleBack, handleCancel };
}
