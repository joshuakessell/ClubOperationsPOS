import { useCallback, useRef, type Dispatch, type SetStateAction } from 'react';
import { safeParseWebSocketEventJson } from '@club-ops/shared';
import { useReconnectingWebSocket, useToast, logDevError } from '@club-ops/ui';
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
  'WAITLIST_UPDATED',
  'SELECTION_PROPOSED',
  'SELECTION_FORCED',
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

  // Side-effect triggers
  fetchWaitlist: () => void;
  fetchInventoryAvailable: () => void;
};

export function buildEmployeeRegisterWsUrl(lane: string): string {
  const wsScheme = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${wsScheme}//${window.location.host}/ws?lane=${encodeURIComponent(lane)}`;
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

export function handleEmployeeRegisterWsMessage(raw: unknown, deps: EmployeeRegisterWsDeps): void {
  const message = safeParseWebSocketEventJson(String(raw));
  if (!message) return;

  // Keep behavior identical to legacy handler: log for debugging.
  // eslint-disable-next-line no-console
  console.log('WebSocket message:', message);

  if (message.type === 'CHECKOUT_REQUESTED') {
    const payload = message.payload;
    deps.setCheckoutRequests((prev) => {
      const next = new Map(prev);
      const request: CheckoutRequestSummary = {
        ...payload.request,
        scheduledCheckoutAt: toDate(payload.request.scheduledCheckoutAt),
        currentTime: toDate(payload.request.currentTime),
      };
      next.set(request.requestId, request);
      return next;
    });
    return;
  }

  if (message.type === 'CHECKOUT_CLAIMED') {
    const payload = message.payload;
    deps.setCheckoutRequests((prev) => {
      const next = new Map(prev);
      next.delete(payload.requestId);
      return next;
    });
    return;
  }

  if (message.type === 'CHECKOUT_UPDATED') {
    const payload = message.payload;
    if (deps.selectedCheckoutRequestRef.current === payload.requestId) {
      deps.setCheckoutItemsConfirmed(payload.itemsConfirmed);
      deps.setCheckoutFeePaid(payload.feePaid);
    }
    return;
  }

  if (message.type === 'CHECKOUT_COMPLETED') {
    const payload = message.payload;
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
    deps.dispatchRegister({ type: 'SESSION_UPDATED', payload: message.payload });
    return;
  }

  if (message.type === 'WAITLIST_UPDATED') {
    deps.fetchWaitlist();
    deps.fetchInventoryAvailable();
    return;
  }

  if (message.type === 'SELECTION_PROPOSED') {
    const payload = message.payload;
    if (payload.sessionId === deps.currentSessionIdRef.current) {
      deps.dispatchRegister({
        type: 'PATCH',
        patch: { proposedRentalType: payload.rentalType, proposedBy: payload.proposedBy },
      });
    }
    return;
  }

  if (message.type === 'SELECTION_LOCKED') {
    const payload = message.payload;
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
    const payload = message.payload;
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
}

export function useEmployeeRegisterWs(deps: EmployeeRegisterWsDeps) {
  const { lane } = deps;
  const toast = useToast();
  const lastErrorToastAtRef = useRef<number>(0);
  const toastWsError = (message: string) => {
    const now = Date.now();
    if (now - lastErrorToastAtRef.current < 10_000) return; // throttle
    lastErrorToastAtRef.current = now;
    toast.error(message, { title: 'Live updates' });
  };

  const onMessage = useCallback(
    (event: MessageEvent) => {
      try {
        handleEmployeeRegisterWsMessage(event.data, deps);
      } catch (error) {
        logDevError(error, 'ws.message');
        toastWsError('Received an invalid live update. Reconnecting…');
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
    onError: () => {
      toastWsError('WebSocket connection error. Retrying…');
    },
  });
}

