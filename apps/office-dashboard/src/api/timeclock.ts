import { apiJson } from './index';

export type TimeclockSession = {
  id: string;
  employeeId: string;
  employeeName: string;
  shiftId: string | null;
  clockInAt: string;
  clockOutAt: string | null;
  source: string;
  notes: string | null;
};

export type TimeclockListResponse = {
  sessions: TimeclockSession[];
};

export async function fetchTimeclockSessions(
  sessionToken: string,
  query: string,
  signal?: AbortSignal
): Promise<TimeclockListResponse> {
  const sessions = await apiJson<TimeclockSession[]>(`/v1/admin/timeclock?${query}`, {
    sessionToken,
    signal,
  });

  return { sessions };
}

export async function closeTimeclockSession(
  sessionToken: string,
  sessionId: string,
  signal?: AbortSignal
): Promise<void> {
  await apiJson(`/v1/admin/timeclock/${sessionId}/close`, {
    method: 'POST',
    sessionToken,
    signal,
  });
}

export async function updateTimeclockSession(
  sessionToken: string,
  sessionId: string,
  updates: unknown,
  signal?: AbortSignal
): Promise<void> {
  await apiJson(`/v1/admin/timeclock/${sessionId}`, {
    method: 'PATCH',
    sessionToken,
    body: updates,
    signal,
  });
}

export async function fetchTimeclockSession(
  sessionToken: string,
  sessionId: string,
  signal?: AbortSignal
): Promise<TimeclockSession> {
  return apiJson<TimeclockSession>(`/v1/admin/timeclock/${sessionId}`, {
    sessionToken,
    signal,
  });
}
