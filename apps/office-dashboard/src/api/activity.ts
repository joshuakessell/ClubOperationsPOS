import { apiJson } from '../api';

// ── Types ──

export type ActivityEvent = {
  id: string;
  occurredAt: string;
  customerId: string;
  customerName: string;
  actionType: string;
  actionCategory: string;
  actorStaffName: string | null;
  summary: string;
  metadata?: unknown;
};

export type AuditEvent = {
  id: string;
  createdAt: string;
  action: string;
  entityType: string;
  entityId: string;
  userId: string | null;
  userRole: string | null;
  staffId: string | null;
  staffName: string | null;
  oldValue: unknown;
  newValue: unknown;
  overrideReason: string | null;
  metadata: unknown;
  cursor: string;
};

export type ActivityStats = {
  totalEvents: number;
  byCategory: { category: string; count: number }[];
  hourlyDistribution: { hour: number; label: string; count: number }[];
  topStaff: { staffId: string; staffName: string; count: number }[];
};

export type OperationsSummary = {
  from: string;
  to: string;
  revenue: {
    total: number;
    avgPerDay: number;
    transactions: number;
    avgTransaction: number;
  };
  tips: { totalCents: number; totalDollars: number };
  activity: {
    checkIns: number;
    checkOuts: number;
    uniqueCustomers: number;
    avgCheckInsPerDay: number;
  };
  labor: {
    totalHours: number;
    employeeCount: number;
    revenuePerLaborHour: number;
  };
  occupancy: { totalRooms: number; occupied: number; rate: number };
  overrides: number;
};

export type HeatmapData = {
  weeks: number;
  activityGrid: { day: string; hour: number; count: number }[];
  revenueGrid: { day: string; hour: number; total: number }[];
};

export type RevenueBreakdown = {
  from: string;
  to: string;
  byPaymentMethod: { method: string; total: number; count: number }[];
  byDayOfWeek: { dow: number; dayName: string; total: number; count: number }[];
  byRentalType: { rentalType: string; total: number; count: number }[];
  tips: {
    totalDollars: number;
    avgTipDollars: number;
    tipCount: number;
    tipPercentOfRevenue: number;
  };
};

export type LaborCostReport = {
  from: string;
  to: string;
  hourlyRate: number;
  totals: {
    scheduledHours: number;
    actualHours: number;
    laborCost: number;
    totalRevenue: number;
    revenuePerLaborHour: number;
  };
  employees: {
    employeeId: string;
    employeeName: string;
    scheduledHours: number;
    actualHours: number;
    variance: number;
    shiftCount: number;
    clockSessions: number;
    laborCost: number;
    overtimeHours: number;
    revenueAttributed: number;
    revenuePerHour: number;
  }[];
};

export type RevenueTrend = {
  days: number;
  trend: { date: string; revenue: number; transactions: number }[];
};

// ── Fetchers ──

type SessionAuth = { sessionToken: string };

export async function fetchActivityLog(
  auth: SessionAuth,
  params: {
    q?: string;
    category?: string;
    actionType?: string;
    from?: string;
    to?: string;
    cursor?: string;
    limit?: number;
  },
  signal?: AbortSignal
) {
  const qs = new URLSearchParams();
  if (params.q?.trim()) qs.set('q', params.q.trim());
  if (params.category) qs.set('actionCategories', params.category);
  if (params.actionType) qs.set('actionTypes', params.actionType);
  if (params.from) qs.set('from', new Date(params.from).toISOString());
  if (params.to) qs.set('to', new Date(params.to).toISOString());
  if (params.cursor) qs.set('cursor', params.cursor);
  qs.set('limit', String(params.limit ?? 50));

  return apiJson<{ events: ActivityEvent[]; nextCursor: string | null }>(
    `/v1/admin/activity-log?${qs}`,
    { sessionToken: auth.sessionToken, signal }
  );
}

export async function fetchAuditLog(
  auth: SessionAuth,
  params: {
    from?: string;
    to?: string;
    actions?: string;
    entityType?: string;
    staffId?: string;
    cursor?: string;
    limit?: number;
  },
  signal?: AbortSignal
) {
  const qs = new URLSearchParams();
  if (params.from) qs.set('from', new Date(params.from).toISOString());
  if (params.to) qs.set('to', new Date(params.to).toISOString());
  if (params.actions) qs.set('actions', params.actions);
  if (params.entityType) qs.set('entityType', params.entityType);
  if (params.staffId) qs.set('staffId', params.staffId);
  if (params.cursor) qs.set('cursor', params.cursor);
  qs.set('limit', String(params.limit ?? 50));

  return apiJson<{ events: AuditEvent[]; nextCursor: string | null }>(
    `/v1/admin/activity-log/audit?${qs}`,
    { sessionToken: auth.sessionToken, signal }
  );
}

export async function fetchActivityStats(
  auth: SessionAuth,
  params: { from?: string; to?: string; category?: string; actionType?: string },
  signal?: AbortSignal
) {
  const qs = new URLSearchParams();
  if (params.from) qs.set('from', new Date(params.from).toISOString());
  if (params.to) qs.set('to', new Date(params.to).toISOString());
  if (params.category) qs.set('category', params.category);
  if (params.actionType) qs.set('actionType', params.actionType);

  return apiJson<ActivityStats>(`/v1/admin/activity-log/stats?${qs}`, {
    sessionToken: auth.sessionToken,
    signal,
  });
}

export async function fetchOperationsSummary(
  auth: SessionAuth,
  params: { from?: string; to?: string },
  signal?: AbortSignal
) {
  const qs = new URLSearchParams();
  if (params.from) qs.set('from', params.from);
  if (params.to) qs.set('to', params.to);

  return apiJson<OperationsSummary>(`/v1/admin/reports/operations-summary?${qs}`, {
    sessionToken: auth.sessionToken,
    signal,
  });
}

export async function fetchHourlyHeatmap(
  auth: SessionAuth,
  params: { weeks?: number },
  signal?: AbortSignal
) {
  const qs = new URLSearchParams();
  if (params.weeks) qs.set('weeks', String(params.weeks));

  return apiJson<HeatmapData>(`/v1/admin/reports/hourly-heatmap?${qs}`, {
    sessionToken: auth.sessionToken,
    signal,
  });
}

export async function fetchRevenueBreakdown(
  auth: SessionAuth,
  params: { from?: string; to?: string },
  signal?: AbortSignal
) {
  const qs = new URLSearchParams();
  if (params.from) qs.set('from', params.from);
  if (params.to) qs.set('to', params.to);

  return apiJson<RevenueBreakdown>(`/v1/admin/reports/revenue-breakdown?${qs}`, {
    sessionToken: auth.sessionToken,
    signal,
  });
}

export async function fetchLaborCost(
  auth: SessionAuth,
  params: { from?: string; to?: string; hourlyRate?: number },
  signal?: AbortSignal
) {
  const qs = new URLSearchParams();
  if (params.from) qs.set('from', params.from);
  if (params.to) qs.set('to', params.to);
  if (params.hourlyRate) qs.set('hourlyRate', String(params.hourlyRate));

  return apiJson<LaborCostReport>(`/v1/admin/reports/labor-cost?${qs}`, {
    sessionToken: auth.sessionToken,
    signal,
  });
}

export async function fetchRevenueTrend(
  auth: SessionAuth,
  params: { days?: number },
  signal?: AbortSignal
) {
  const qs = new URLSearchParams();
  if (params.days) qs.set('days', String(params.days));

  return apiJson<RevenueTrend>(`/v1/admin/reports/revenue-trend?${qs}`, {
    sessionToken: auth.sessionToken,
    signal,
  });
}
