/**
 * Shared date/time formatting utilities for the office dashboard.
 * All functions default to the America/Chicago timezone.
 */

const DEFAULT_TIMEZONE = 'America/Chicago';

/**
 * Format an ISO date string to a short time string like "2:30 PM".
 */
export function formatTime(isoString: string, timeZone = DEFAULT_TIMEZONE): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone,
  });
}

/**
 * Format an ISO date string to e.g. "Feb 16, 2026".
 */
export function formatDate(isoString: string, timeZone = DEFAULT_TIMEZONE): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone,
  });
}

/**
 * Calculate the difference between two ISO date strings in hours.
 * Returns "—" if clockOut is null (session still open).
 */
export function calculateHours(clockIn: string, clockOut: string | null): string {
  if (!clockOut) return '—';
  const start = new Date(clockIn).getTime();
  const end = new Date(clockOut).getTime();
  const hours = (end - start) / (1000 * 60 * 60);
  return `${hours.toFixed(2)}h`;
}
