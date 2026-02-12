import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type {
  AssignmentFailedPayload,
  CheckoutChecklist,
  CheckoutRequestSummary,
  SessionUpdatedPayload,
} from '@club-ops/shared';
import { useRegisterRealtimeEvents } from '../../useRegisterRealtimeEvents';
import type { BottomToast } from '../../../components/register/toasts/BottomToastStack';
import type { NavTab } from '../shared/types';

type LaneSessionActions = {
  applySessionUpdated: (payload: SessionUpdatedPayload) => void;
  applySelectionProposed: (payload: {
    rentalType: string;
    proposedBy: 'CUSTOMER' | 'EMPLOYEE';
  }) => void;
  applySelectionLocked: (payload: {
    rentalType: string;
    confirmedBy: 'CUSTOMER' | 'EMPLOYEE';
  }) => void;
  applySelectionForced: (payload: { rentalType: string }) => void;
  selectionAcknowledged: () => void;
};

type InventorySelection = {
  type: 'room' | 'locker';
  id: string;
  number: string;
  tier: string;
};

type CustomerConfirmationType = {
  requested: string;
  selected: string;
  number: string;
};

type Params = {
  lane: string;
  staffToken?: string | null;
  currentSessionId: string | null;
  selectedCheckoutRequest: string | null;
  customerSelectedType: string | null;
  laneSessionActions: LaneSessionActions;
  setCheckoutRequests: Dispatch<SetStateAction<Map<string, CheckoutRequestSummary>>>;
  setCheckoutItemsConfirmed: Dispatch<SetStateAction<boolean>>;
  setCheckoutFeePaid: Dispatch<SetStateAction<boolean>>;
  setSelectedCheckoutRequest: Dispatch<SetStateAction<string | null>>;
  setCheckoutChecklist: Dispatch<SetStateAction<CheckoutChecklist>>;
  refreshWaitlistAndInventory: () => void;
  refreshInventoryAvailable: () => void;
  setSelectedInventoryItem: (value: InventorySelection | null) => void;
  setShowAddOnSaleModal: (value: boolean) => void;
  resetAddOnCart: () => void;
  resetMembershipPrompt: () => void;
  setShowWaitlistModal: (value: boolean) => void;
  setCurrentSessionCustomerId: (value: string | null) => void;
  setAccountCustomerId: (value: string | null) => void;
  setAccountCustomerLabel: (value: string | null) => void;
  selectNavTab: (value: NavTab) => void;
  pushBottomToast: (toast: Omit<BottomToast, 'id'> & { id?: string }, ttlMs?: number) => void;
  setShowCustomerConfirmationPending: (value: boolean) => void;
  setCustomerConfirmationType: (value: CustomerConfirmationType | null) => void;
};

export function useRegisterRealtimeState({
  lane,
  staffToken,
  currentSessionId,
  selectedCheckoutRequest,
  customerSelectedType,
  laneSessionActions,
  setCheckoutRequests,
  setCheckoutItemsConfirmed,
  setCheckoutFeePaid,
  setSelectedCheckoutRequest,
  setCheckoutChecklist,
  refreshWaitlistAndInventory,
  refreshInventoryAvailable,
  setSelectedInventoryItem,
  setShowAddOnSaleModal,
  resetAddOnCart,
  resetMembershipPrompt,
  setShowWaitlistModal,
  setCurrentSessionCustomerId,
  setAccountCustomerId,
  setAccountCustomerLabel,
  selectNavTab,
  pushBottomToast,
  setShowCustomerConfirmationPending,
  setCustomerConfirmationType,
}: Params) {
  const OFFLINE_GRACE_MS = 12000;
  const selectedCheckoutRequestRef = useRef<string | null>(null);
  useEffect(() => {
    selectedCheckoutRequestRef.current = selectedCheckoutRequest;
  }, [selectedCheckoutRequest]);

  const currentSessionIdRef = useRef<string | null>(null);
  useEffect(() => {
    currentSessionIdRef.current = currentSessionId;
  }, [currentSessionId]);

  const customerSelectedTypeRef = useRef<string | null>(null);
  useEffect(() => {
    customerSelectedTypeRef.current = customerSelectedType;
  }, [customerSelectedType]);

  const realtime = useRegisterRealtimeEvents({
    lane,
    staffToken,
    currentSessionIdRef,
    selectedCheckoutRequestRef,
    customerSelectedTypeRef,
    laneSessionActions: {
      applySessionUpdated: laneSessionActions.applySessionUpdated,
      applySelectionProposed: ({ rentalType, proposedBy }) =>
        laneSessionActions.applySelectionProposed({ rentalType, proposedBy }),
      applySelectionLocked: ({ rentalType, confirmedBy }) =>
        laneSessionActions.applySelectionLocked({ rentalType, confirmedBy }),
      applySelectionForced: ({ rentalType }) =>
        laneSessionActions.applySelectionForced({ rentalType }),
      selectionAcknowledged: laneSessionActions.selectionAcknowledged,
    },
    setCheckoutRequests,
    setCheckoutItemsConfirmed,
    setCheckoutFeePaid,
    setSelectedCheckoutRequest,
    setCheckoutChecklist,
    onWaitlistUpdated: () => {
      refreshWaitlistAndInventory();
    },
    onInventoryUpdated: () => {
      refreshInventoryAvailable();
    },
    onLaneSessionCleared: () => {
      setSelectedInventoryItem(null);
      setShowAddOnSaleModal(false);
      resetAddOnCart();
      resetMembershipPrompt();
      setShowWaitlistModal(false);
      setCurrentSessionCustomerId(null);
      setAccountCustomerId(null);
      setAccountCustomerLabel(null);
      selectNavTab('scan');
    },
    pushBottomToast,
    onAssignmentFailed: (payload: AssignmentFailedPayload) => {
      pushBottomToast({ message: `Assignment failed: ${payload.reason}`, tone: 'warning' });
      setSelectedInventoryItem(null);
    },
    onCustomerConfirmed: () => {
      setShowCustomerConfirmationPending(false);
      setCustomerConfirmationType(null);
    },
    onCustomerDeclined: () => {
      setShowCustomerConfirmationPending(false);
      setCustomerConfirmationType(null);
      if (customerSelectedTypeRef.current) {
        setSelectedInventoryItem(null);
      }
    },
  });

  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [realtimeMode, setRealtimeMode] = useState<'cloud' | 'lan'>('cloud');
  const offlineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (realtime.connected) {
      if (offlineTimerRef.current) {
        clearTimeout(offlineTimerRef.current);
        offlineTimerRef.current = null;
      }
      setRealtimeConnected(true);
      return;
    }

    if (offlineTimerRef.current) return;
    offlineTimerRef.current = setTimeout(() => {
      offlineTimerRef.current = null;
      setRealtimeConnected(false);
    }, OFFLINE_GRACE_MS);
  }, [realtime.connected]);

  useEffect(() => {
    if (!realtime.connected) return;
    setRealtimeMode(realtime.mode);
  }, [realtime.connected, realtime.mode]);

  useEffect(() => {
    return () => {
      if (offlineTimerRef.current) {
        clearTimeout(offlineTimerRef.current);
        offlineTimerRef.current = null;
      }
    };
  }, []);

  return { realtimeConnected, realtimeMode, currentSessionIdRef };
}
