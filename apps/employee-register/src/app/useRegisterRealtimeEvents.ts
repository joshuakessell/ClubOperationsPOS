import { useEffect, useRef } from 'react';
import { safeParseRealtimeEvent } from '@club-ops/shared';
import { useLaneSession } from '@club-ops/shared/realtime/useLaneSession';
import { safeJsonParse } from '@club-ops/ui';
import {
  applyRegisterRealtimeEvent,
  type RegisterRealtimeParams,
} from './registerRealtimeHandlers';

export function useRegisterRealtimeEvents(params: RegisterRealtimeParams): {
  connected: boolean;
} {
  const { lane, staffToken } = params;
  const rawEnv = import.meta.env as unknown as Record<string, unknown>;
  const kioskToken =
    typeof rawEnv.VITE_KIOSK_TOKEN === 'string' && rawEnv.VITE_KIOSK_TOKEN.trim()
      ? rawEnv.VITE_KIOSK_TOKEN.trim()
      : null;

  const { connected, lastMessage } = useLaneSession({
    laneId: lane,
    role: 'employee',
    kioskToken: kioskToken ?? '',
    staffToken: staffToken ?? undefined,
    enabled: Boolean(lane) && Boolean((kioskToken && kioskToken.trim()) || staffToken),
    reconnectMode: 'default',
  });

  const paramsRef = useRef(params);
  useEffect(() => {
    paramsRef.current = params;
  }, [params]);

  useEffect(() => {
    if (!lastMessage) return;
    try {
      const parsed: unknown = safeJsonParse(String(lastMessage.data));
      const message = safeParseRealtimeEvent(parsed);
      if (!message) return;
      applyRegisterRealtimeEvent(message, paramsRef.current);
    } catch (error) {
      console.error('Failed to parse realtime message:', error);
    }
  }, [lastMessage]);

  return { connected };
}
