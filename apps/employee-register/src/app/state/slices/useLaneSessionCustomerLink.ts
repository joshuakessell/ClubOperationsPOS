import { useEffect } from 'react';

/**
 * Server realtime payloads do not include `customerId`, but some UI surfaces need to know
 * which customer the lane session *should* be associated with.
 *
 * While there is no active session, we mirror the selected account customer onto the lane session
 * customerId as UI context. This allows session-driven UI (e.g. Employee Assist) to stay consistent
 * once realtime updates arrive.
 */
export function useLaneSessionCustomerLink(params: {
  accountCustomerId: string | null;
  currentSessionId: string | null;
  laneSessionCustomerId: string | null;
  setCurrentSessionCustomerId: (value: string | null) => void;
}) {
  const {
    accountCustomerId,
    currentSessionId,
    laneSessionCustomerId,
    setCurrentSessionCustomerId,
  } = params;

  useEffect(() => {
    if (!accountCustomerId) return;

    // If the lane session doesn't know its customer (common when WS sessionId changes and the
    // reducer resets state), restore it from the currently opened account.
    if (!laneSessionCustomerId) {
      setCurrentSessionCustomerId(accountCustomerId);
      return;
    }

    // While there is no active session, keep lane-session customerId aligned with whichever
    // account is open. Once a session is active, avoid overriding an already-known customerId.
    if (!currentSessionId && laneSessionCustomerId !== accountCustomerId) {
      setCurrentSessionCustomerId(accountCustomerId);
    }
  }, [
    accountCustomerId,
    currentSessionId,
    laneSessionCustomerId,
    setCurrentSessionCustomerId,
  ]);
}
