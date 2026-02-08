import {
  useCallback,
  useEffect,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';
import {
  safeParseRealtimeEvent,
  SessionUpdatedPayloadSchema,
  type CustomerConfirmationRequiredPayload,
  type SessionUpdatedPayload,
} from '@club-ops/shared';
import { useLaneSession } from '@club-ops/shared/realtime/useLaneSession';
import { isRecord, readJson, safeJsonParse } from '@club-ops/ui';
import type { SessionState } from '../../utils/membership';

type KioskRealtimeSessionActions = {
  applySessionUpdatedPayload: (payload: SessionUpdatedPayload) => void;
  setProposedRentalType: (value: string | null) => void;
  setProposedBy: (value: 'CUSTOMER' | 'EMPLOYEE' | null) => void;
  setSelectionConfirmed: (value: boolean) => void;
  setSelectionConfirmedBy: (value: 'CUSTOMER' | 'EMPLOYEE' | null) => void;
  setSelectedRental: (value: string | null) => void;
  setSelectionAcknowledged: (value: boolean) => void;
  setHighlightedLanguage: (value: 'EN' | 'ES' | null) => void;
  setHighlightedMembershipChoice: (value: 'ONE_TIME' | 'SIX_MONTH' | null) => void;
  setHighlightedWaitlistBackup: (value: string | null) => void;
  setCustomerConfirmationData: (value: CustomerConfirmationRequiredPayload | null) => void;
  setShowCustomerConfirmation: (value: boolean) => void;
  setSession: Dispatch<SetStateAction<SessionState>>;
  setView: (
    view:
      | 'idle'
      | 'language'
      | 'selection'
      | 'payment'
      | 'agreement'
      | 'agreement-bypass'
      | 'complete'
  ) => void;
  resetToIdle: () => void;
};

type KioskRealtimeInventoryActions = {
  applyInventoryUpdate: (payload: unknown) => void;
};

type KioskRealtimeApi = {
  apiBase: string;
  kioskAuthHeaders: (extra?: Record<string, string>) => Record<string, string>;
};

export function useKioskRealtime({
  lane,
  kioskToken,
  sessionIdRef,
  api,
  sessionActions,
  inventoryActions,
}: {
  lane: string | null;
  kioskToken: string | null;
  sessionIdRef: MutableRefObject<string | null>;
  api: KioskRealtimeApi;
  sessionActions: KioskRealtimeSessionActions;
  inventoryActions: KioskRealtimeInventoryActions;
}) {
  const apiBase = api.apiBase;
  const kioskAuthHeaders = api.kioskAuthHeaders;
  const applySessionUpdatedPayload = sessionActions.applySessionUpdatedPayload;
  const resetToIdle = sessionActions.resetToIdle;

  const { connected: realtimeConnected, lastMessage } = useLaneSession({
    laneId: lane ?? undefined,
    role: 'customer',
    kioskToken: kioskToken ?? '',
    enabled: Boolean(lane),
    reconnectMode: 'aggressive',
  });

  const hasConnectedRef = useRef(false);
  useEffect(() => {
    if (realtimeConnected) {
      hasConnectedRef.current = true;
    }
  }, [realtimeConnected]);

  const onRealtimeMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const parsed: unknown = safeJsonParse(String(event.data));
        const message = safeParseRealtimeEvent(parsed);
        if (!message) return;
        if (import.meta.env.DEV) {
          console.log('Realtime message:', message);
        }

        if (message.type === 'SESSION_UPDATED') {
          sessionActions.applySessionUpdatedPayload(message.payload);
        } else if (message.type === 'SELECTION_PROPOSED') {
          const payload = message.payload;
          if (payload.sessionId === sessionIdRef.current) {
            sessionActions.setProposedRentalType(payload.rentalType);
            sessionActions.setProposedBy(payload.proposedBy);
          }
        } else if (message.type === 'SELECTION_LOCKED') {
          const payload = message.payload;
          if (payload.sessionId === sessionIdRef.current) {
            sessionActions.setSelectionConfirmed(true);
            sessionActions.setSelectionConfirmedBy(payload.confirmedBy);
            sessionActions.setSelectedRental(payload.rentalType);
            sessionActions.setSelectionAcknowledged(true);
            sessionActions.setView('payment');
          }
        } else if (message.type === 'SELECTION_FORCED') {
          const payload = message.payload;
          if (payload.sessionId === sessionIdRef.current) {
            sessionActions.setSelectionConfirmed(true);
            sessionActions.setSelectionConfirmedBy('EMPLOYEE');
            sessionActions.setSelectedRental(payload.rentalType);
            sessionActions.setSelectionAcknowledged(true);
            sessionActions.setView('payment');
          }
        } else if (message.type === 'SELECTION_ACKNOWLEDGED') {
          sessionActions.setSelectionAcknowledged(true);
        } else if (message.type === 'CHECKIN_OPTION_HIGHLIGHTED') {
          const payload = message.payload;
          if (payload.sessionId !== sessionIdRef.current) return;
          if (payload.step === 'LANGUAGE') {
            const opt = payload.option === 'EN' || payload.option === 'ES' ? payload.option : null;
            sessionActions.setHighlightedLanguage(opt);
          } else if (payload.step === 'MEMBERSHIP') {
            const opt =
              payload.option === 'ONE_TIME' || payload.option === 'SIX_MONTH'
                ? payload.option
                : null;
            sessionActions.setHighlightedMembershipChoice(opt);
          } else if (payload.step === 'WAITLIST_BACKUP') {
            sessionActions.setHighlightedWaitlistBackup(payload.option);
          }
        } else if (message.type === 'CUSTOMER_CONFIRMATION_REQUIRED') {
          const payload = message.payload;
          sessionActions.setCustomerConfirmationData(payload);
          sessionActions.setShowCustomerConfirmation(true);
        } else if (message.type === 'ASSIGNMENT_CREATED') {
          const payload = message.payload;
          if (payload.sessionId === sessionIdRef.current) {
            const assignedResourceType = payload.roomNumber
              ? 'room'
              : payload.lockerNumber
                ? 'locker'
                : undefined;
            const assignedResourceNumber = payload.roomNumber ?? payload.lockerNumber;
            if (assignedResourceType && assignedResourceNumber) {
              sessionActions.setSession((prev) => ({
                ...prev,
                assignedResourceType,
                assignedResourceNumber,
              }));
              sessionActions.setView('complete');
            }
          }
        } else if (message.type === 'INVENTORY_UPDATED') {
          inventoryActions.applyInventoryUpdate(message.payload);
        }
      } catch (error) {
        console.error('Failed to parse realtime message:', error);
      }
    },
    [
      inventoryActions,
      sessionActions,
      sessionIdRef,
    ]
  );

  useEffect(() => {
    const processEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } })
      .process?.env;
    const isTestEnv = processEnv?.NODE_ENV === 'test' || processEnv?.VITEST === 'true';
    if (!isTestEnv) return;
    const testBus = globalThis as { __kioskRealtimeTest__?: (event: unknown) => void };
    const handler = (event: unknown) => {
      onRealtimeMessage({ data: JSON.stringify(event ?? {}) } as MessageEvent);
    };
    testBus.__kioskRealtimeTest__ = handler;
    return () => {
      if (testBus.__kioskRealtimeTest__ === handler) {
        delete testBus.__kioskRealtimeTest__;
      }
    };
  }, [onRealtimeMessage]);

  useEffect(() => {
    if (!lastMessage) return;
    onRealtimeMessage(lastMessage);
  }, [lastMessage, onRealtimeMessage]);

  const pollSessionSnapshotOnce = useCallback(
    async (laneId: string) => {
      try {
        const res = await fetch(
          `${apiBase}/v1/checkin/lane/${encodeURIComponent(laneId)}/session-snapshot`,
          { headers: kioskAuthHeaders() }
        );
        if (!res.ok) return;
        const data = await readJson<unknown>(res);
        if (!isRecord(data)) return;
        const sessionPayload = data['session'];
        if (sessionPayload == null) {
          resetToIdle();
          return;
        }
        if (isRecord(sessionPayload)) {
          const parsedPayload = SessionUpdatedPayloadSchema.safeParse(sessionPayload);
          if (parsedPayload.success) {
            applySessionUpdatedPayload(parsedPayload.data);
          }
        }
      } catch {
        // Best-effort; realtime/polling will continue.
      }
    },
    [apiBase, kioskAuthHeaders, applySessionUpdatedPayload, resetToIdle]
  );

  const initialSnapshotLaneRef = useRef<string | null>(null);
  useEffect(() => {
    const laneId = lane;
    if (!laneId) return;
    if (initialSnapshotLaneRef.current === laneId) return;
    initialSnapshotLaneRef.current = laneId;
    void pollSessionSnapshotOnce(laneId);
  }, [lane, pollSessionSnapshotOnce]);

  const pollingStartedRef = useRef(false);
  const pollingDelayTimerRef = useRef<number | null>(null);
  const pollingIntervalRef = useRef<number | null>(null);
  const lastIdlePollAtRef = useRef(0);
  useEffect(() => {
    const laneId = lane;
    if (!laneId) return;
    if (pollingDelayTimerRef.current !== null) {
      window.clearTimeout(pollingDelayTimerRef.current);
      pollingDelayTimerRef.current = null;
    }
    if (pollingIntervalRef.current !== null) {
      window.clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    pollingStartedRef.current = false;

    const graceMs = realtimeConnected ? 0 : hasConnectedRef.current ? 8000 : 6000;
    pollingDelayTimerRef.current = window.setTimeout(() => {
      if (!pollingStartedRef.current) {
        pollingStartedRef.current = true;
        if (!realtimeConnected) {
          console.info('[customer-kiosk] Realtime disconnected; entering polling fallback');
        }
      }

      const pollOnce = async () => {
        if (realtimeConnected && !sessionIdRef.current) {
          const now = Date.now();
          if (now - lastIdlePollAtRef.current < 2500) {
            return;
          }
          lastIdlePollAtRef.current = now;
        }

        await pollSessionSnapshotOnce(laneId);
      };

      void pollOnce();
      pollingIntervalRef.current = window.setInterval(() => {
        void pollOnce();
      }, 1500);
    }, graceMs);

    return () => {
      if (pollingDelayTimerRef.current !== null) {
        window.clearTimeout(pollingDelayTimerRef.current);
        pollingDelayTimerRef.current = null;
      }
      if (pollingIntervalRef.current !== null) {
        window.clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      pollingStartedRef.current = false;
    };
  }, [lane, pollSessionSnapshotOnce, realtimeConnected, sessionIdRef]);

  return { realtimeConnected };
}
