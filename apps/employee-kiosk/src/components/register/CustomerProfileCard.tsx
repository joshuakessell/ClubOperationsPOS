import type { ReactNode } from 'react';
import { getCustomerMembershipStatus } from '@club-ops/shared';

export type CheckinStage = { number: 1 | 2 | 3 | 4 | 5 | 6; label: string };

export interface CustomerProfileCardProps {
  name: string;
  preferredLanguage?: 'EN' | 'ES' | null;
  dob?: string | null; // YYYY-MM-DD
  dobMonthDay?: string | null; // MM/DD
  idNumber?: string | null;
  idExpirationDate?: string | null; // YYYY-MM-DD
  idType?: 'STATE_ID' | 'DRIVERS_LICENSE' | 'PASSPORT' | 'OTHER' | null;
  idTypeOther?: string | null;
  membershipNumber?: string | null;
  membershipValidUntil?: string | null; // YYYY-MM-DD
  lastVisitAt?: string | null; // ISO timestamp
  hasEncryptedLookupMarker?: boolean;
  checkinStage?: CheckinStage | null;
  waitlistDesiredTier?: string | null;
  waitlistBackupType?: string | null;
  footer?: ReactNode;
  compact?: boolean;
  onToggleLanguage?: () => void;
}

/* ── Helpers ─────────────────────────────────────────────── */

function formatMmYyFromYyyyMmDd(value: string | null | undefined): string {
  if (!value) return '—';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const mm = value.slice(5, 7);
    const yy = value.slice(2, 4);
    return `${mm}/${yy}`;
  }
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return '—';
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  return `${mm}/${yy}`;
}

function formatMmDdYyyyFromYyyyMmDd(value: string | null | undefined): string {
  if (!value) return '—';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const yyyy = value.slice(0, 4);
    const mm = value.slice(5, 7);
    const dd = value.slice(8, 10);
    return `${mm}/${dd}/${yyyy}`;
  }
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return '—';
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yyyy = String(d.getFullYear());
  return `${mm}/${dd}/${yyyy}`;
}

function formatMmYyFromTimestamp(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return '—';
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  return `${mm}/${yy}`;
}

/* ── Component ───────────────────────────────────────────── */

export function CustomerProfileCard(props: CustomerProfileCardProps) {
  const membershipStatus = getCustomerMembershipStatus(
    {
      membershipNumber: props.membershipNumber || null,
      membershipValidUntil: props.membershipValidUntil || null,
    },
    new Date()
  );
  const isMember = membershipStatus === 'ACTIVE';

  const dobDisplay = props.dob
    ? formatMmDdYyyyFromYyyyMmDd(props.dob)
    : props.dobMonthDay
      ? `${props.dobMonthDay}/—`
      : '—';

  const languageLabel =
    props.preferredLanguage === 'EN'
      ? 'English'
      : props.preferredLanguage === 'ES'
        ? 'Español'
        : '—';

  const idTypeLabel = (() => {
    switch (props.idType) {
      case 'STATE_ID':
        return 'State ID';
      case 'DRIVERS_LICENSE':
        return 'Drivers License';
      case 'PASSPORT':
        return 'Passport';
      case 'OTHER':
        return props.idTypeOther?.trim() ? `Other (${props.idTypeOther})` : 'Other';
      default:
        return '—';
    }
  })();

  const compact = Boolean(props.compact);

  /* ── TailAdmin UserInfoCard-style layout ──────────────── */
  return (
    <div
      className={
        compact
          ? undefined
          : 'p-5 border border-gray-200 rounded-2xl dark:border-gray-800 lg:p-6'
      }
    >
      {/* Header: customer name + checkin stage */}
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-lg font-semibold text-gray-800 dark:text-white/90">
          {props.name || '—'}
        </h4>
        {props.checkinStage ? (
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
            Stage {props.checkinStage.number} — {props.checkinStage.label}
          </span>
        ) : null}
      </div>

      {/* Detail grid — TailAdmin UserInfoCard pattern */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-7">
        {/* Language */}
        <div>
          <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">
            Preferred Language
          </p>
          {props.onToggleLanguage ? (
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 shadow-theme-xs transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]"
              onClick={props.onToggleLanguage}
            >
              {languageLabel === '—' ? 'Set Language' : languageLabel}
            </button>
          ) : (
            <p className="text-sm font-medium text-gray-800 dark:text-white/90">{languageLabel}</p>
          )}
        </div>

        {/* DOB */}
        <div>
          <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">DOB</p>
          <p className="text-sm font-medium text-gray-800 dark:text-white/90">{dobDisplay}</p>
        </div>

        {/* ID Type */}
        <div>
          <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">ID Type</p>
          <p className="text-sm font-medium text-gray-800 dark:text-white/90">{idTypeLabel}</p>
        </div>

        {/* ID # */}
        <div>
          <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">ID #</p>
          <p className="text-sm font-medium text-gray-800 dark:text-white/90">
            {props.idNumber || '—'}
          </p>
        </div>

        {/* ID Expiration */}
        <div>
          <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">ID Exp</p>
          <p className="text-sm font-medium text-gray-800 dark:text-white/90">
            {formatMmDdYyyyFromYyyyMmDd(props.idExpirationDate)}
          </p>
        </div>

        {/* Member */}
        <div>
          <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">Member</p>
          <p className="text-sm font-medium text-gray-800 dark:text-white/90">
            {isMember ? 'Yes' : 'No'}
          </p>
        </div>

        {/* Membership ID */}
        <div>
          <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">
            Membership ID
          </p>
          <p className="text-sm font-medium text-gray-800 dark:text-white/90">
            {props.membershipNumber || '—'}
          </p>
        </div>

        {/* Membership Exp */}
        <div>
          <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">
            Membership Exp
          </p>
          <p className="text-sm font-medium text-gray-800 dark:text-white/90">
            {isMember ? formatMmYyFromYyyyMmDd(props.membershipValidUntil) : '—'}
          </p>
        </div>

        {/* Last Visit */}
        <div>
          <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">
            Last Visit
          </p>
          <p className="text-sm font-medium text-gray-800 dark:text-white/90">
            {formatMmYyFromTimestamp(props.lastVisitAt)}
          </p>
        </div>
      </div>

      {/* Waitlist banner */}
      {props.waitlistDesiredTier && props.waitlistBackupType ? (
        <div
          className="mt-4 rounded-lg border-2 border-warning-500 bg-warning-50 p-3"
          style={{ color: '#92400e' }}
        >
          <div className="text-sm font-semibold" style={{ marginBottom: '0.25rem' }}>
            Customer Waitlisted
          </div>
          <div className="text-xs">
            Requested <strong>{props.waitlistDesiredTier}</strong>; backup{' '}
            <strong>{props.waitlistBackupType}</strong>.
          </div>
        </div>
      ) : null}

      {/* Footer (e.g. Start Checkin button) */}
      {props.footer ? (
        <div className="mt-4 flex justify-center">{props.footer}</div>
      ) : null}
    </div>
  );
}
