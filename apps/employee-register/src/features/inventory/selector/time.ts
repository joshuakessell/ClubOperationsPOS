import type { AlertLevel } from './types';

export const DUE_SOON_MS = 30 * 60 * 1000;

export function getMsUntil(iso: string | undefined, nowMs: number): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return t - nowMs;
}

export function formatDurationHuman(msUntil: number): { label: string; isOverdue: boolean } {
  const isOverdue = msUntil < 0;
  const minutesTotalRaw = Math.max(0, Math.ceil(Math.abs(msUntil) / (60 * 1000)));
  const minutesTotal = minutesTotalRaw;
  const hours = Math.floor(minutesTotal / 60);
  const minutes = minutesTotal % 60;

  if (hours <= 0) {
    return { label: `${minutesTotal} mins`, isOverdue };
  }
  if (minutes === 0) {
    return { label: `${hours} hr`, isOverdue };
  }
  return { label: `${hours} hr ${minutes} mins`, isOverdue };
}

export function formatTimeOfDay(iso: string | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function alertLevelFromMsUntil(msUntil: number | null | undefined): AlertLevel {
  if (msUntil === null || msUntil === undefined) return null;
  if (!Number.isFinite(msUntil)) return null;
  if (msUntil < 0) return 'danger';
  if (msUntil <= DUE_SOON_MS) return 'warning';
  return null;
}

export function maxAlert(a: AlertLevel, b: AlertLevel): AlertLevel {
  if (a === 'danger' || b === 'danger') return 'danger';
  if (a === 'warning' || b === 'warning') return 'warning';
  return null;
}

