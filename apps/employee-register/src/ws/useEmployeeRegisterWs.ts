import { useCallback, type Dispatch, type SetStateAction } from 'react';
import {
  type WebSocketEvent,
  type CheckoutRequestedPayload,
  type CheckoutClaimedPayload,
  type CheckoutUpdatedPayload,
  type SessionUpdatedPayload,
  type SelectionProposedPayload,
  type SelectionLockedPayload,
  type SelectionForcedPayload,
  type AssignmentCreatedPayload,
  type AssignmentFailedPayload,
  type CustomerConfirmedPayload,
  type CustomerDeclinedPayload,
} from '@club-ops/shared';
import { safeJsonParse, useReconnectingWebSocket, isRecord } from '@club-ops/ui';
import type { CheckoutChecklist, CheckoutRequestSummary } from '@club-ops/shared';
import type { RegisterSessionAction } from '../app/registerSessionReducer';

export const EMPLOYEE_REGISTER_WS_SUBSCRIPTIONS = [
  'CHECKOUT_REQUESTED',
  'CHECKOUT_CLAIMED',
  'CHECKOUT_UPDATED',
  'CHECKOUT_COMPLETED',
  'SESSION_UPDATED',
  'ROOM_STATUS_CHANGED',
  'INVENTORY_UPDATED',
  'ASSIGNMENT_CREATED',
  'ASSIGNMENT_FAILED',
  'CUSTOMER_CONFIRMED',
  'CUSTOMER_DECLINED',
  'WAITLIST_UPDATED',
  'SELECTION_PROPOSED',
  'SELECTION_LOCKED',
  'SELECTION_ACKNOWLEDGED',
] as const;

export type EmployeeRegisterWsDeps = {
  lane: string;
  dispatchRegister: (action: RegisterSessionAction) => void;

  // Refs (stable)
  selectedCheckoutRequestRef: { current: string | null };
  currentSessionIdRef: { current: string | null };
  customerSelectedTypeRef: { current: string | null };

  // Local state setters / callbacks
  setCheckoutRequests: Dispatch<SetStateAction<Map<string, CheckoutRequestSummary>>>;
  setSelectedCheckoutRequest: Dispatch<SetStateAction<string | null>>;
  setCheckoutChecklist: Dispatch<SetStateAction<CheckoutChecklist>>;
  setCheckoutItemsConfirmed: Dispatch<SetStateAction<boolean>>;
  setCheckoutFeePaid: Dispatch<SetStateAction<boolean>>;
  setSelectedInventoryItem: Dispatch<
    SetStateAction<{ type: 'room' | 'locker'; id: string; number: string; tier: string } | null>
  >;
  setShowCustomerConfirmationPending: Dispatch<SetStateAction<boolean>>;
  setCustomerConfirmationType: Dispatch<SetStateAction<{ requested: string; selected: string; number: string } | null>>;

  // Side-effect triggers
  fetchWaitlist: () => void;
  fetchInventoryAvailable: () => void;
};

export function buildEmployeeRegisterWsUrl(lane: string): string {
  const wsScheme = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${wsScheme}//${window.location.host}/ws?lane=${encodeURIComponent(lane)}`;
}

export function handleEmployeeRegisterWsMessage(raw: unknown, deps: EmployeeRegisterWsDeps): void {
  const parsed: unknown = safeJsonParse(String(raw));
  if (!isRecord(parsed) || typeof parsed.type !== 'string') return;
  const message = parsed as unknown as WebSocketEvent;

  // Keep behavior identical to legacy handler: log for debugging.
  // eslint-disable-next-line no-console
  console.log('WebSocket message:', message);

  if (message.type === 'CHECKOUT_REQUESTED') {
    const payload = message.payload as CheckoutRequestedPayload;
    deps.setCheckoutRequests((prev) => {
      const next = new Map(prev);
      next.set(payload.request.requestId, payload.request);
      return next;
    });
    return;
  }

  if (message.type === 'CHECKOUT_CLAIMED') {
    const payload = message.payload as CheckoutClaimedPayload;
    deps.setCheckoutRequests((prev) => {
      const next = new Map(prev);
      next.delete(payload.requestId);
      return next;
    });
    return;
  }

  if (message.type === 'CHECKOUT_UPDATED') {
    const payload = message.payload as CheckoutUpdatedPayload;
    if (deps.selectedCheckoutRequestRef.current === payload.requestId) {
      deps.setCheckoutItemsConfirmed(payload.itemsConfirmed);
      deps.setCheckoutFeePaid(payload.feePaid);
    }
    return;
  }

  if (message.type === 'CHECKOUT_COMPLETED') {
    const payload = message.payload as { requestId: string };
    deps.setCheckoutRequests((prev) => {
      const next = new Map(prev);
      next.delete(payload.requestId);
      return next;
    });
    if (deps.selectedCheckoutRequestRef.current === payload.requestId) {
      deps.setSelectedCheckoutRequest(null);
      deps.setCheckoutChecklist({});
      deps.setCheckoutItemsConfirmed(false);
      deps.setCheckoutFeePaid(false);
    }
    return;
  }

  if (message.type === 'SESSION_UPDATED') {
    const payload = message.payload as SessionUpdatedPayload;
    deps.dispatchRegister({ type: 'SESSION_UPDATED', payload });
    return;
  }

  if (message.type === 'WAITLIST_UPDATED') {
    deps.fetchWaitlist();
    deps.fetchInventoryAvailable();
    return;
  }

  if (message.type === 'SELECTION_PROPOSED') {
    const payload = message.payload as SelectionProposedPayload;
    if (payload.sessionId === deps.currentSessionIdRef.current) {
      deps.dispatchRegister({
        type: 'PATCH',
        patch: { proposedRentalType: payload.rentalType, proposedBy: payload.proposedBy },
      });
    }
    return;
  }

  if (message.type === 'SELECTION_LOCKED') {
    const payload = message.payload as SelectionLockedPayload;
    if (payload.sessionId === deps.currentSessionIdRef.current) {
      deps.dispatchRegister({
        type: 'PATCH',
        patch: {
          selectionConfirmed: true,
          selectionConfirmedBy: payload.confirmedBy,
          customerSelectedType: payload.rentalType,
          selectionAcknowledged: true,
        },
      });
    }
    return;
  }

  if (message.type === 'SELECTION_FORCED') {
    const payload = message.payload as SelectionForcedPayload;
    if (payload.sessionId === deps.currentSessionIdRef.current) {
      deps.dispatchRegister({
        type: 'PATCH',
        patch: {
          selectionConfirmed: true,
          selectionConfirmedBy: 'EMPLOYEE',
          customerSelectedType: payload.rentalType,
          selectionAcknowledged: true,
        },
      });
    }
    return;
  }

  if (message.type === 'SELECTION_ACKNOWLEDGED') {
    deps.dispatchRegister({ type: 'PATCH', patch: { selectionAcknowledged: true } });
    return;
  }

  if (message.type === 'INVENTORY_UPDATED' || message.type === 'ROOM_STATUS_CHANGED') {
    deps.fetchInventoryAvailable();
    return;
  }

  if (message.type === 'ASSIGNMENT_CREATED') {
    const payload = message.payload as AssignmentCreatedPayload;
    if (payload.sessionId === deps.currentSessionIdRef.current) {
      // Assignment success: SessionUpdated will carry assigned resource details.
    }
    return;
  }

  if (message.type === 'ASSIGNMENT_FAILED') {
    const payload = message.payload as AssignmentFailedPayload;
    if (payload.sessionId === deps.currentSessionIdRef.current) {
      // Handle race condition - refresh and re-select
      alert('Assignment failed: ' + payload.reason);
      deps.setSelectedInventoryItem(null);
    }
    return;
  }

  if (message.type === 'CUSTOMER_CONFIRMED') {
    const payload = message.payload as CustomerConfirmedPayload;
    if (payload.sessionId === deps.currentSessionIdRef.current) {
      deps.setShowCustomerConfirmationPending(false);
      deps.setCustomerConfirmationType(null);
    }
    return;
  }

  if (message.type === 'CUSTOMER_DECLINED') {
    const payload = message.payload as CustomerDeclinedPayload;
    if (payload.sessionId === deps.currentSessionIdRef.current) {
      deps.setShowCustomerConfirmationPending(false);
      deps.setCustomerConfirmationType(null);
      // Revert to customer's requested type
      if (deps.customerSelectedTypeRef.current) {
        deps.setSelectedInventoryItem(null);
        // This will trigger auto-selection in InventorySelector
      }
    }
    return;
  }
}

export function useEmployeeRegisterWs(deps: EmployeeRegisterWsDeps) {
  const { lane } = deps;

  const onMessage = useCallback(
    (event: MessageEvent) => {
      try {
        handleEmployeeRegisterWsMessage(event.data, deps);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to parse WebSocket message:', error);
      }
    },
    [deps]
  );

  const wsUrl = buildEmployeeRegisterWsUrl(lane);
  return useReconnectingWebSocket({
    url: wsUrl,
    onOpenSendJson: [
      {
        type: 'subscribe',
        events: [...EMPLOYEE_REGISTER_WS_SUBSCRIPTIONS],
      },
    ],
    onMessage,
  });
}

