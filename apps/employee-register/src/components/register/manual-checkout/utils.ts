export function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

export function formatClockTime(value: string | Date): string {
  const d = toDate(value);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function formatLateDuration(minutesLate: number): string {
  const total = Math.max(0, Math.floor(minutesLate));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

export function formatDeltaMinutesLabel(scheduledCheckoutAt: string | Date): {
  label: string;
  color: string;
} {
  const scheduled = toDate(scheduledCheckoutAt);
  const diffMs = scheduled.getTime() - Date.now();
  const mins = Math.max(0, Math.ceil(Math.abs(diffMs) / 60000));
  const hmm = formatLateDuration(mins);
  if (diffMs < 0) return { label: `Past ${hmm}`, color: '#ef4444' };
  return { label: `In ${hmm}`, color: '#fbbf24' };
}
