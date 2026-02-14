import { apiJson } from './index';

export type RegisterSessionStatus = {
  registerNumber: number;
  active: boolean;
  secondsSinceHeartbeat: number | null;
  employee: {
    staffId: string;
    displayName: string;
    role: 'STAFF' | 'ADMIN';
  } | null;
  deviceId: string | null;
  createdAt: string | null;
};

export type RegisterSessionStatusResponse = {
  registers: RegisterSessionStatus[];
};

export async function fetchRegisterSessionsStatus(
  sessionToken: string,
  signal?: AbortSignal
): Promise<RegisterSessionStatusResponse> {
  const registers = await apiJson<RegisterSessionStatus[]>('/v1/admin/register-sessions', {
    sessionToken,
    signal,
  });
  return { registers };
}

export async function forceRegisterSignOut(
  sessionToken: string,
  registerNumber: number,
  signal?: AbortSignal
): Promise<void> {
  await apiJson(`/v1/admin/register-sessions/${registerNumber}/force-signout`, {
    method: 'POST',
    sessionToken,
    signal,
  });
}
