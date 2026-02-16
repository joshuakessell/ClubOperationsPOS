import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  fetchShifts,
  fetchShiftTemplates,
  fetchWeeklySummary,
  createShift,
  deleteShift,
  type ScheduleShift,
  type ShiftTemplate,
  type WeeklySummaryEntry,
} from '../api/schedule';
import { fetchStaff, type StaffMember } from '../api/staffAdmin';

// ── Helpers ──────────────────────────────────────────────────

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]!;
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// ── Types ────────────────────────────────────────────────────

interface ShiftCreateModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  sessionToken: string;
  employees: StaffMember[];
  templates: ShiftTemplate[];
  defaultEmployeeId?: string;
  defaultDate?: string;
}

// ── ShiftCreateModal ─────────────────────────────────────────

function ShiftCreateModal({
  open,
  onClose,
  onCreated,
  sessionToken,
  employees,
  templates,
  defaultEmployeeId,
  defaultDate,
}: ShiftCreateModalProps) {
  const [employeeId, setEmployeeId] = useState(defaultEmployeeId ?? '');
  const [selectedTemplate, setSelectedTemplate] = useState<ShiftTemplate | null>(null);
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('16:00');
  const [date, setDate] = useState(defaultDate ?? formatDate(new Date()));
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (defaultEmployeeId) setEmployeeId(defaultEmployeeId);
    if (defaultDate) setDate(defaultDate);
  }, [defaultEmployeeId, defaultDate]);

  const handleTemplateSelect = (templateId: string) => {
    const t = templates.find((t) => t.id === templateId);
    if (t) {
      setSelectedTemplate(t);
      setStartTime(t.defaultStartTime.slice(0, 5));
      setEndTime(t.defaultEndTime.slice(0, 5));
    } else {
      setSelectedTemplate(null);
    }
  };

  const handleSubmit = async () => {
    if (!employeeId) {
      setError('Select an employee');
      return;
    }

    setError(null);
    setBusy(true);
    try {
      await createShift(sessionToken, {
        employee_id: employeeId,
        starts_at: `${date}T${startTime}:00.000Z`,
        ends_at: `${date}T${endTime}:00.000Z`,
        shift_code: selectedTemplate?.label.charAt(0) ?? 'A',
        color: selectedTemplate?.color ?? '#3b82f6',
        template_id: selectedTemplate?.id ?? null,
        notes: notes || null,
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create shift');
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  const inputCls =
    'w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2.5 text-sm text-gray-200 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40';

  return (
    <div className="fixed inset-0 z-99999 flex items-center justify-center bg-gray-950/80 backdrop-blur-sm">
      <div
        className="relative w-full max-w-md rounded-2xl border border-gray-800 bg-gray-900 shadow-theme-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white/90">Create Shift</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-col gap-4 px-6 py-5">
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-error-500/30 bg-error-500/10 p-3 text-sm text-error-400">
              <span className="flex-1">{error}</span>
              <button className="text-error-400/60 hover:text-error-400" onClick={() => setError(null)}>
                ✕
              </button>
            </div>
          )}

          {/* Employee */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-300">Employee</label>
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className={inputCls}
            >
              <option value="">Select employee…</option>
              {employees
                .filter((e) => e.active)
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
            </select>
          </div>

          {/* Template */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-300">Template</label>
            <select
              value={selectedTemplate?.id ?? ''}
              onChange={(e) => handleTemplateSelect(e.target.value)}
              className={inputCls}
            >
              <option value="">Custom</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label} ({t.defaultStartTime.slice(0, 5)}–{t.defaultEndTime.slice(0, 5)})
                </option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-300">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={inputCls}
            />
          </div>

          {/* Start / End time */}
          <div className="flex gap-3">
            <div className="flex-1 flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-300">Start Time</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className={inputCls}
              />
            </div>
            <div className="flex-1 flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-300">End Time</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-300">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className={inputCls + ' resize-none'}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="border-t border-gray-800 px-6 py-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={busy}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-gray-300 ring-1 ring-inset ring-gray-700 hover:bg-white/[0.05] transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={busy || !employeeId}
            className="flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy && (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            )}
            {busy ? 'Creating…' : 'Create Shift'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ShiftCard ────────────────────────────────────────────────

interface ShiftCardProps {
  shift: ScheduleShift;
  onDelete: (id: string) => void;
  compact?: boolean;
}

function ShiftCard({ shift, onDelete, compact }: ShiftCardProps) {
  const isCanceled = shift.status === 'CANCELED';
  const color = shift.color ?? '#3b82f6';

  return (
    <div
      className={`group relative rounded p-1.5 ${compact ? 'p-1' : 'p-2'} cursor-pointer transition-all duration-150 ${
        isCanceled ? 'opacity-50 line-through' : ''
      }`}
      style={{
        borderLeft: `3px solid ${color}`,
        backgroundColor: isCanceled ? 'rgba(0,0,0,0.05)' : `${color}15`,
      }}
    >
      <div className="flex items-start justify-between">
        <div>
          <span className="block text-xs font-semibold leading-tight text-gray-200">
            {formatTime(shift.scheduledStart)} – {formatTime(shift.scheduledEnd)}
          </span>
          {!compact && shift.shiftCode && (
            <span className="text-[11px] text-gray-400">{shift.shiftCode}</span>
          )}
        </div>
        {!isCanceled && (
          <button
            className="opacity-0 group-hover:opacity-100 flex h-5 w-5 items-center justify-center rounded text-gray-500 hover:text-gray-200 transition-all text-[10px]"
            title="Cancel shift"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(shift.id);
            }}
          >
            ✕
          </button>
        )}
      </div>
      {!compact && shift.notes && (
        <span className="block mt-0.5 text-[11px] text-gray-400">{shift.notes}</span>
      )}
    </div>
  );
}

// ── ScheduleView (main) ─────────────────────────────────────

interface ScheduleViewProps {
  sessionToken: string;
}

export function ScheduleView({ sessionToken }: ScheduleViewProps) {
  const [weekStart, setWeekStart] = useState<Date>(getWeekStart(new Date()));
  const [shifts, setShifts] = useState<ScheduleShift[]>([]);
  const [employees, setEmployees] = useState<StaffMember[]>([]);
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [weeklySummary, setWeeklySummary] = useState<WeeklySummaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create shift modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createDefaults, setCreateDefaults] = useState<{
    employeeId?: string;
    date?: string;
  }>({});

  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fromStr = formatDate(weekStart);
      const toStr = formatDate(addDays(weekStart, 7));

      const [shiftsData, staffData, templatesData, summaryData] = await Promise.all([
        fetchShifts(sessionToken, { from: fromStr, to: toStr }),
        fetchStaff(sessionToken, new URLSearchParams()),
        fetchShiftTemplates(sessionToken),
        fetchWeeklySummary(sessionToken, fromStr),
      ]);

      setShifts(shiftsData);
      setEmployees(staffData.staff);
      setTemplates(templatesData.templates);
      setWeeklySummary(summaryData.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load schedule');
    } finally {
      setLoading(false);
    }
  }, [sessionToken, weekStart]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDeleteShift = async (shiftId: string) => {
    try {
      await deleteShift(sessionToken, shiftId);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete shift');
    }
  };

  const openCreateModal = (employeeId?: string, date?: string) => {
    setCreateDefaults({ employeeId, date });
    setCreateModalOpen(true);
  };

  // Group shifts by employee and day
  const gridData = useMemo(() => {
    const activeEmployees = employees.filter((e) => e.active);
    return activeEmployees.map((employee) => {
      const employeeShifts = shifts.filter(
        (s) => s.employeeId === employee.id && s.status !== 'CANCELED'
      );
      const dayShifts = weekDates.map((date) => {
        const dateStr = formatDate(date);
        return employeeShifts.filter((s) => s.scheduledStart.startsWith(dateStr));
      });
      const summary = weeklySummary.find((s) => s.employeeId === employee.id);
      return { employee, dayShifts, summary };
    });
  }, [employees, shifts, weekDates, weeklySummary]);

  const navigateWeek = (direction: -1 | 1) => {
    setWeekStart(addDays(weekStart, direction * 7));
  };

  const goToToday = () => {
    setWeekStart(getWeekStart(new Date()));
  };

  if (loading && shifts.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-gray-700 border-t-brand-500" />
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigateWeek(-1)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-white/[0.05] hover:text-white transition-colors"
          >
            ◀
          </button>
          <h2 className="text-lg font-semibold text-white/90">
            {weekStart.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} –{' '}
            {addDays(weekStart, 6).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </h2>
          <button
            onClick={() => navigateWeek(1)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-white/[0.05] hover:text-white transition-colors"
          >
            ▶
          </button>
          <button
            onClick={goToToday}
            className="ml-1 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-300 ring-1 ring-inset ring-gray-700 hover:bg-white/[0.05] transition-colors"
          >
            Today
          </button>
        </div>
        <button
          onClick={() => openCreateModal()}
          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 transition-colors"
        >
          + Add Shift
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 mb-3 rounded-lg border border-error-500/30 bg-error-500/10 p-3 text-sm text-error-400">
          <span className="flex-1">{error}</span>
          <button className="text-error-400/60 hover:text-error-400" onClick={() => setError(null)}>
            ✕
          </button>
        </div>
      )}

      {/* Template legend */}
      <div className="flex gap-1.5 mb-3 flex-wrap">
        {templates.map((t) => (
          <span
            key={t.id}
            className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium text-gray-300"
            style={{
              backgroundColor: `${t.color}20`,
              borderLeft: `3px solid ${t.color}`,
            }}
          >
            {t.label}
          </span>
        ))}
      </div>

      {/* Weekly grid */}
      <div className="rounded-xl border border-gray-800 overflow-auto">
        <div
          className="grid min-w-[900px]"
          style={{ gridTemplateColumns: '160px repeat(7, 1fr) 100px' }}
        >
          {/* Header row */}
          <div className="p-2 border-b-2 border-gray-800 bg-gray-900/80">
            <span className="text-sm font-semibold text-gray-300">Employee</span>
          </div>
          {weekDates.map((date, i) => {
            const isToday = formatDate(date) === formatDate(new Date());
            return (
              <div
                key={i}
                className={`p-2 border-b-2 border-gray-800 border-l border-l-gray-800 text-center ${
                  isToday ? 'bg-brand-500/10' : 'bg-gray-900/80'
                }`}
              >
                <span className="block text-xs font-semibold text-gray-400 uppercase">
                  {DAY_NAMES[i]}
                </span>
                <span
                  className={`block text-sm ${
                    isToday ? 'font-bold text-brand-400' : 'text-gray-300'
                  }`}
                >
                  {date.getDate()}
                </span>
              </div>
            );
          })}
          <div className="p-2 border-b-2 border-gray-800 border-l border-l-gray-800 bg-gray-900/80 text-center">
            <span className="text-sm font-semibold text-gray-300">Hours</span>
          </div>

          {/* Employee rows */}
          {gridData.map(({ employee, dayShifts, summary }) => (
            <div key={employee.id} className="contents">
              {/* Employee name cell */}
              <div className="p-2 border-b border-gray-800 flex items-center gap-1.5">
                <span className="text-sm font-medium text-gray-200 truncate">
                  {employee.name}
                </span>
                {employee.role === 'ADMIN' && (
                  <span className="inline-flex items-center rounded bg-brand-500/20 px-1 py-px text-[10px] font-semibold text-brand-400">
                    A
                  </span>
                )}
              </div>

              {/* Day cells */}
              {dayShifts.map((dayShiftList, dayIdx) => (
                <div
                  key={dayIdx}
                  onClick={() =>
                    dayShiftList.length === 0 &&
                    openCreateModal(employee.id, formatDate(weekDates[dayIdx]!))
                  }
                  className={`p-1 border-b border-gray-800 border-l border-l-gray-800 min-h-[52px] flex flex-col gap-0.5 transition-colors ${
                    dayShiftList.length === 0
                      ? 'cursor-pointer hover:bg-white/[0.02]'
                      : ''
                  }`}
                >
                  {dayShiftList.length > 0
                    ? dayShiftList.map((shift) => (
                        <ShiftCard
                          key={shift.id}
                          shift={shift}
                          onDelete={handleDeleteShift}
                          compact={dayShiftList.length > 1}
                        />
                      ))
                    : null}
                </div>
              ))}

              {/* Hours summary cell */}
              <div className="p-2 border-b border-gray-800 border-l border-l-gray-800 text-center flex flex-col justify-center">
                {summary ? (
                  <>
                    <span
                      className={`text-sm font-semibold ${
                        summary.overtimeFlag ? 'text-error-400' : 'text-gray-200'
                      }`}
                    >
                      {summary.netHours.toFixed(1)}h
                    </span>
                    <span className="text-[11px] text-gray-400">
                      {summary.shiftCount} shifts
                    </span>
                    {summary.overtimeFlag && (
                      <span className="mt-0.5 inline-block rounded bg-error-500/20 px-1 py-px text-[9px] font-bold text-error-400">
                        OT
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-xs text-gray-500">–</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Create shift modal */}
      <ShiftCreateModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreated={loadData}
        sessionToken={sessionToken}
        employees={employees}
        templates={templates}
        defaultEmployeeId={createDefaults.employeeId}
        defaultDate={createDefaults.date}
      />
    </div>
  );
}
