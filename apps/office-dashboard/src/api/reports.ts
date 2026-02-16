import { apiJson } from './index';

// ── Types ──────────────────────────────────────────────────

export type DailySummary = {
  date: string;
  totalRevenue: number;
  revenueByMethod: Record<string, number>;
  totalCheckIns: number;
  uniqueCustomers: number;
  totalTips: number;
};

export type RevenueTrendEntry = {
  date: string;
  revenue: number;
  transactions: number;
};

export type RevenueTrend = {
  days: number;
  trend: RevenueTrendEntry[];
};

export type StaffProductivityEntry = {
  staffId: string;
  staffName: string;
  checkIns: number;
  paymentsProcessed: number;
  revenueAttributed: number;
};

export type StaffProductivity = {
  from: string;
  to: string;
  staff: StaffProductivityEntry[];
};

export type HourlyEntry = {
  hour: number;
  label: string;
  checkIns: number;
  revenue: number;
};

export type StaffHourlyProductivity = {
  date: string;
  staffId: string;
  hours: HourlyEntry[];
};

// ── API functions ──────────────────────────────────────────

export async function fetchDailySummary(
  sessionToken: string,
  date?: string,
  signal?: AbortSignal
): Promise<DailySummary> {
  const qs = date ? `?date=${date}` : '';
  return apiJson(`/v1/admin/reports/daily-summary${qs}`, { sessionToken, signal });
}

export async function fetchRevenueTrend(
  sessionToken: string,
  days: number = 30,
  signal?: AbortSignal
): Promise<RevenueTrend> {
  return apiJson(`/v1/admin/reports/revenue-trend?days=${days}`, { sessionToken, signal });
}

export async function fetchStaffProductivity(
  sessionToken: string,
  params?: { from?: string; to?: string; staffId?: string },
  signal?: AbortSignal
): Promise<StaffProductivity> {
  const qs = new URLSearchParams();
  if (params?.from) qs.set('from', params.from);
  if (params?.to) qs.set('to', params.to);
  if (params?.staffId) qs.set('staffId', params.staffId);
  const q = qs.toString();
  return apiJson(`/v1/admin/reports/staff-productivity${q ? `?${q}` : ''}`, {
    sessionToken,
    signal,
  });
}

export async function fetchStaffHourlyProductivity(
  sessionToken: string,
  staffId: string,
  date: string,
  signal?: AbortSignal
): Promise<StaffHourlyProductivity> {
  return apiJson(
    `/v1/admin/reports/staff-productivity-hourly?staffId=${staffId}&date=${date}`,
    { sessionToken, signal }
  );
}
