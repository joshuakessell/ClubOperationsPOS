import { useCallback } from 'react';
import { getApiUrl } from '@club-ops/shared';
import { useKioskLane } from './useKioskLane';
import { useOrientationOverlay } from './useOrientationOverlay';
import { useKioskSessionState } from './useKioskSessionState';
import { useKioskInventory } from './useKioskInventory';
import { useKioskRealtime } from './useKioskRealtime';
import { useKioskActions } from './useKioskActions';
import { usePulseHighlightStyles } from './usePulseHighlightStyles';
import { useKioskNotice } from './useKioskNotice';

export function useKioskController() {
  usePulseHighlightStyles();
  const apiBase = getApiUrl('/api');
  const rawEnv = import.meta.env as unknown as Record<string, unknown>;
  const processEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env;
  const kioskToken =
    typeof rawEnv.VITE_KIOSK_TOKEN === 'string' && rawEnv.VITE_KIOSK_TOKEN.trim()
      ? rawEnv.VITE_KIOSK_TOKEN.trim()
      : typeof processEnv?.VITE_KIOSK_TOKEN === 'string' && processEnv.VITE_KIOSK_TOKEN.trim()
        ? processEnv.VITE_KIOSK_TOKEN.trim()
      : null;

  const kioskAuthHeaders = useCallback(
    (extra?: Record<string, string>) => {
      return {
        ...(extra ?? {}),
        ...(kioskToken ? { 'x-kiosk-token': kioskToken } : {}),
      };
    },
    [kioskToken]
  );

  const { lane, handleLaneSelection } = useKioskLane();
  const sessionState = useKioskSessionState();
  const noticeState = useKioskNotice();
  const { orientationOverlay } = useOrientationOverlay(
    sessionState.session.customerPrimaryLanguage
  );
  const inventoryState = useKioskInventory({ apiBase, enabled: Boolean(lane) });

  useKioskRealtime({
    lane,
    kioskToken,
    sessionIdRef: sessionState.sessionIdRef,
    api: {
      apiBase,
      kioskAuthHeaders,
    },
    sessionActions: {
      applySessionUpdatedPayload: sessionState.applySessionUpdatedPayload,
      setProposedRentalType: sessionState.setProposedRentalType,
      setProposedBy: sessionState.setProposedBy,
      setSelectionConfirmed: sessionState.setSelectionConfirmed,
      setSelectionConfirmedBy: sessionState.setSelectionConfirmedBy,
      setSelectedRental: sessionState.setSelectedRental,
      setSelectionAcknowledged: sessionState.setSelectionAcknowledged,
      setHighlightedLanguage: sessionState.setHighlightedLanguage,
      setHighlightedMembershipChoice: sessionState.setHighlightedMembershipChoice,
      setHighlightedWaitlistBackup: sessionState.setHighlightedWaitlistBackup,
      setCustomerConfirmationData: sessionState.setCustomerConfirmationData,
      setShowCustomerConfirmation: sessionState.setShowCustomerConfirmation,
      setSession: sessionState.setSession,
      setView: sessionState.setView,
      resetToIdle: sessionState.resetToIdle,
    },
    inventoryActions: {
      applyInventoryUpdate: inventoryState.applyInventoryUpdate,
    },
  });

  const actions = useKioskActions({
    apiBase,
    lane,
    kioskAuthHeaders,
    session: sessionState.session,
    isSubmitting: sessionState.isSubmitting,
    setIsSubmitting: sessionState.setIsSubmitting,
    setView: sessionState.setView,
    resetToIdle: sessionState.resetToIdle,
    showNotice: noticeState.showNotice,
  });

  return {
    apiBase,
    kioskToken,
    kioskAuthHeaders,
    lane,
    handleLaneSelection,
    orientationOverlay,
    inventory: inventoryState.inventory,
    refreshInventory: inventoryState.refreshInventory,
    notice: noticeState.notice,
    showNotice: noticeState.showNotice,
    clearNotice: noticeState.clearNotice,
    ...sessionState,
    ...actions,
  };
}
