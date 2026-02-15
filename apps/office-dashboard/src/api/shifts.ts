import { apiJson } from './index';
import type { Shift, TimeOffRequest } from '../shifts/types';

export async function fetchScheduleShifts(
  sessionToken: string,
  params: URLSearchParams,
  signal?: AbortSignal
): Promise<Shift[]> {
  return apiJson<Shift[]>(`/v1/schedule/shifts?${params}`, { sessionToken, signal });
}

export async function fetchAdminShifts(
  sessionToken: string,
  params: URLSearchParams,
  signal?: AbortSignal
): Promise<Shift[]> {
  return apiJson<Shift[]>(`/v1/admin/shifts?${params}`, { sessionToken, signal });
}

export async function updateShift(
  sessionToken: string,
  shiftId: string,
  body: unknown,
  signal?: AbortSignal
): Promise<void> {
  await apiJson(`/v1/admin/shifts/${shiftId}`, {
    method: 'PATCH',
    sessionToken,
    body,
    signal,
  });
}

export async function fetchScheduleTimeOffRequests(
  sessionToken: string,
  fromDate: string,
  toDate: string,
  signal?: AbortSignal
): Promise<{ requests: TimeOffRequest[] }> {
  return apiJson<{ requests: TimeOffRequest[] }>(
    `/v1/schedule/time-off-requests?from=${fromDate}&to=${toDate}`,
    { sessionToken, signal }
  );
}

export async function createScheduleTimeOffRequest(
  sessionToken: string,
  body: { requestedDate: string; reason: string },
  signal?: AbortSignal
): Promise<void> {
  await apiJson('/v1/schedule/time-off-requests', {
    method: 'POST',
    sessionToken,
    body,
    signal,
  });
}

export async function fetchAdminPendingTimeOffRequests(
  sessionToken: string,
  signal?: AbortSignal
): Promise<{ requests: TimeOffRequest[] }> {
  return apiJson<{ requests: TimeOffRequest[] }>('/v1/admin/time-off-requests?status=PENDING', {
    sessionToken,
    signal,
  });
}

export async function updateAdminTimeOffRequest(
  sessionToken: string,
  requestId: string,
  body: { status: 'APPROVED' | 'DENIED' },
  signal?: AbortSignal
): Promise<void> {
  await apiJson(`/v1/admin/time-off-requests/${requestId}`, {
    method: 'PATCH',
    sessionToken,
    body,
    signal,
  });
}

