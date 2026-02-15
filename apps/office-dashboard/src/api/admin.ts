import { apiJson } from './index';

export type KPI = {
  roomsOccupied: number;
  roomsUnoccupied: number;
  roomsDirty: number;
  roomsCleaning: number;
  roomsClean: number;
  lockersOccupied: number;
  lockersAvailable: number;
  waitingListCount: number;
};

export type RoomExpiration = {
  roomId: string;
  roomNumber: string;
  roomTier: string;
  sessionId: string;
  customerName: string;
  membershipNumber: string | null;
  checkoutAt: string;
  minutesPast: number | null;
  minutesRemaining: number | null;
  isExpired: boolean;
  isExpiringSoon: boolean;
};

export type RoomExpirationsResponse = {
  expirations: RoomExpiration[];
};

export type MetricsSummary = {
  from: string;
  to: string;
  averageDirtyTimeMinutes: number | null;
  dirtyTimeSampleCount: number;
  averageCleaningDurationMinutes: number | null;
  cleaningDurationSampleCount: number;
  totalRoomsCleaned: number;
};

export async function fetchAdminKpi(sessionToken: string, signal?: AbortSignal): Promise<KPI> {
  return apiJson<KPI>('/v1/admin/kpi', { sessionToken, signal });
}

export async function fetchRoomExpirations(
  sessionToken: string,
  signal?: AbortSignal
): Promise<RoomExpirationsResponse> {
  return apiJson<RoomExpirationsResponse>('/v1/admin/rooms/expirations', { sessionToken, signal });
}

export async function fetchMetricsSummary(
  sessionToken: string,
  params: URLSearchParams,
  signal?: AbortSignal
): Promise<MetricsSummary> {
  return apiJson<MetricsSummary>(`/v1/admin/metrics/summary?${params}`, { sessionToken, signal });
}

export async function fetchMetricsByStaff(
  sessionToken: string,
  params: URLSearchParams,
  signal?: AbortSignal
): Promise<MetricsSummary & { staffId: string }>
{
  return apiJson<MetricsSummary & { staffId: string }>(`/v1/admin/metrics/by-staff?${params}`, {
    sessionToken,
    signal,
  });
}

