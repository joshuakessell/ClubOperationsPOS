import { getErrorMessage } from '@club-ops/shared';
import { API_BASE } from './api';
import { generateUUID } from './utils';

type FlowActor = 'CUSTOMER' | 'EMPLOYEE' | 'SYSTEM';
type FlowCommandType = 'BACK_STEP' | 'CANCEL_STEP';

function isFlowCommandsEnabled(): boolean {
  return import.meta.env.VITE_FLOW_COMMANDS === '1';
}

export async function sendFlowCommand(params: {
  lane: string;
  sessionToken: string;
  sessionId: string;
  flowVersion: number;
  actor: FlowActor;
  type: FlowCommandType;
}): Promise<void> {
  if (!isFlowCommandsEnabled()) return;

  const response = await fetch(`${API_BASE}/v1/checkin/lane/${params.lane}/flow-command`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.sessionToken}`,
    },
    body: JSON.stringify({
      sessionId: params.sessionId,
      commandId: generateUUID(),
      actor: params.actor,
      expectedFlowVersion: params.flowVersion,
      type: params.type,
    }),
  });

  if (!response.ok) {
    const errorPayload: unknown = await response.json().catch(() => null);
    throw new Error(getErrorMessage(errorPayload) || 'Failed to send flow command');
  }
}
