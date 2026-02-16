import { apiJson } from './index';

// ── Types ──────────────────────────────────────────────────

export type ShiftTemplate = {
  id: string;
  label: string;
  defaultStartTime: string;
  defaultEndTime: string;
  color: string;
  createdAt: string;
};

export type ScheduleShift = {
  id: string;
  employeeId: string;
  employeeName: string;
  shiftCode: string;
  scheduledStart: string;
  scheduledEnd: string;
  color: string | null;
  templateId: string | null;
  breakMinutes: number;
  status: string;
  notes: string | null;
  // Compliance fields (from GET)
  actualClockIn?: string | null;
  actualClockOut?: string | null;
  workedMinutesInWindow?: number;
  scheduledMinutes?: number;
  compliancePercent?: number;
  flags?: string[];
};

export type WeeklySummaryEntry = {
  employeeId: string;
  employeeName: string;
  totalHours: number;
  shiftCount: number;
  totalBreakMinutes: number;
  netHours: number;
  overtimeFlag: boolean;
};

export type WeeklySummaryResponse = {
  weekStart: string;
  summary: WeeklySummaryEntry[];
};

export type BulkCreateResponse = {
  created: number;
  conflicts: { index: number; error: string }[];
  shiftIds: string[];
};

// ── API functions ──────────────────────────────────────────

export async function fetchShiftTemplates(
  sessionToken: string,
  signal?: AbortSignal
): Promise<{ templates: ShiftTemplate[] }> {
  return apiJson('/v1/admin/shift-templates', { sessionToken, signal });
}

export async function createShiftTemplate(
  sessionToken: string,
  body: {
    label: string;
    default_start_time: string;
    default_end_time: string;
    color?: string;
  },
  signal?: AbortSignal
): Promise<ShiftTemplate> {
  return apiJson('/v1/admin/shift-templates', {
    method: 'POST',
    sessionToken,
    body,
    signal,
  });
}

export async function updateShiftTemplate(
  sessionToken: string,
  templateId: string,
  body: Partial<{
    label: string;
    default_start_time: string;
    default_end_time: string;
    color: string;
  }>,
  signal?: AbortSignal
): Promise<ShiftTemplate> {
  return apiJson(`/v1/admin/shift-templates/${templateId}`, {
    method: 'PATCH',
    sessionToken,
    body,
    signal,
  });
}

export async function deleteShiftTemplate(
  sessionToken: string,
  templateId: string,
  signal?: AbortSignal
): Promise<void> {
  await apiJson(`/v1/admin/shift-templates/${templateId}`, {
    method: 'DELETE',
    sessionToken,
    signal,
  });
}

export async function fetchShifts(
  sessionToken: string,
  params: { from?: string; to?: string; employeeId?: string },
  signal?: AbortSignal
): Promise<ScheduleShift[]> {
  const qs = new URLSearchParams();
  if (params.from) qs.set('from', params.from);
  if (params.to) qs.set('to', params.to);
  if (params.employeeId) qs.set('employeeId', params.employeeId);
  return apiJson(`/v1/admin/shifts?${qs}`, { sessionToken, signal });
}

export async function createShift(
  sessionToken: string,
  body: {
    employee_id: string;
    starts_at: string;
    ends_at: string;
    shift_code?: string;
    notes?: string | null;
    color?: string;
    template_id?: string | null;
    break_minutes?: number;
  },
  signal?: AbortSignal
): Promise<ScheduleShift> {
  return apiJson('/v1/admin/shifts', {
    method: 'POST',
    sessionToken,
    body,
    signal,
  });
}

export async function deleteShift(
  sessionToken: string,
  shiftId: string,
  signal?: AbortSignal
): Promise<void> {
  await apiJson(`/v1/admin/shifts/${shiftId}`, {
    method: 'DELETE',
    sessionToken,
    signal,
  });
}

export async function bulkCreateShifts(
  sessionToken: string,
  shifts: Array<{
    employee_id: string;
    starts_at: string;
    ends_at: string;
    shift_code?: string;
    color?: string;
    template_id?: string | null;
    break_minutes?: number;
  }>,
  signal?: AbortSignal
): Promise<BulkCreateResponse> {
  return apiJson('/v1/admin/shifts/bulk', {
    method: 'POST',
    sessionToken,
    body: { shifts },
    signal,
  });
}

export async function fetchWeeklySummary(
  sessionToken: string,
  weekStart: string,
  signal?: AbortSignal
): Promise<WeeklySummaryResponse> {
  return apiJson(`/v1/admin/shifts/weekly-summary?weekStart=${weekStart}`, {
    sessionToken,
    signal,
  });
}
