import { useCallback, useRef } from 'react';
import { getApiUrl } from '@club-ops/shared';
import { useKioskLane } from './useKioskLane';
import { useOrientationOverlay } from './useOrientationOverlay';
import { useKioskSessionState } from './useKioskSessionState';
import { useKioskInventory } from './useKioskInventory';
import { useKioskRealtime } from './useKioskRealtime';
import { useKioskActions } from './useKioskActions';
import { usePulseHighlightStyles } from './usePulseHighlightStyles';
import { useKioskNotice } from './useKioskNotice';
import { useMutationQueue } from './useMutationQueue';

export function useKioskController() {
  usePulseHighlightStyles();

  const rawEnv = import.meta.env as unknown as Record<string, unknown>;
  const processEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env;

  const cloudApiBase = getApiUrl('/api');
  const lanApiBase = (
    typeof rawEnv.VITE_LAN_API_BASE_URL === 'string' && rawEnv.VITE_LAN_API_BASE_URL
      ? rawEnv.VITE_LAN_API_BASE_URL
      : ''
  ).replace(/\/$/, '');

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

  // Cycle breaking: useKioskRealtime needs inventory actions, but useKioskInventory needs apiBase (which depends on realtime mode).
  // We use a ref to proxy the inventory actions.
  const inventoryActionsRef = useRef<{ applyInventoryUpdate: (payload: unknown) => void } | null>(null);

  const { mode } = useKioskRealtime({
    lane,
    kioskToken,
    sessionIdRef: sessionState.sessionIdRef,
    // For snapshot polling inside useKioskRealtime, we'll start with cloud. 
    // Ideally useKioskRealtime would handle its own polling target based on mode,
    // but for now let's pass cloudApiBase.
    api: {
      apiBase: cloudApiBase,
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
      applyInventoryUpdate: (payload) => {
        if (inventoryActionsRef.current) {
          inventoryActionsRef.current.applyInventoryUpdate(payload);
        }
      },
    },
  });

  const activeApiBase = mode === 'lan' && lanApiBase ? lanApiBase : cloudApiBase;

  const inventoryState = useKioskInventory({ apiBase: activeApiBase, enabled: Boolean(lane) });

  // Update the ref so realtime can call it
  inventoryActionsRef.current = inventoryState;

  // Use mutation queue for robust commands
  const { enqueue } = useMutationQueue(activeApiBase, Boolean(lane));

  const actions = useKioskActions({
    apiBase: activeApiBase,
    lane,
    kioskAuthHeaders,
    session: sessionState.session,
    isSubmitting: sessionState.isSubmitting,
    setIsSubmitting: sessionState.setIsSubmitting,
    setView: sessionState.setView,
    resetToIdle: sessionState.resetToIdle,
    showNotice: noticeState.showNotice,
    enqueue,
  });

  return {
    apiBase: activeApiBase,
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
