import type { ActiveCheckinDetails } from './modals/AlreadyCheckedInModal';

export function formatLocal(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d.toLocaleString() : '—';
}

export function getRenewalEligibility(activeCheckin: ActiveCheckinDetails | null) {
  if (!activeCheckin?.checkoutAt) {
    return { withinWindow: false, allowTwoHour: false, allowSixHour: false, totalHours: null };
  }
  const checkoutAt = new Date(activeCheckin.checkoutAt);
  const totalHours =
    typeof activeCheckin.currentTotalHours === 'number' ? activeCheckin.currentTotalHours : null;
  const diffMs = Math.abs(checkoutAt.getTime() - Date.now());
  const withinWindow = Number.isFinite(diffMs) && diffMs <= 60 * 60 * 1000;
  const allowTwoHour = withinWindow && totalHours !== null && totalHours + 2 <= 14;
  const allowSixHour = withinWindow && totalHours !== null && totalHours + 6 <= 14;
  return { withinWindow, allowTwoHour, allowSixHour, totalHours };
}
