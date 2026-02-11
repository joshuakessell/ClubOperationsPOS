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
}

function Detail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div
        className="er-text-sm"
        style={{ color: '#94a3b8', marginBottom: '0.15rem', fontWeight: 800 }}
      >
        {label}
      </div>
      <div
        className="er-text-md"
        style={{
          fontWeight: 900,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {value}
      </div>
    </div>
  );
}

function formatMmYyFromYyyyMmDd(value: string | null | undefined): string {
  if (!value) return '—';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const yyyy = value.slice(0, 4);
    const mm = value.slice(5, 7);
    const yy = yyyy.slice(-2);
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

  return (
    <div className={compact ? undefined : 'cs-liquid-card'} style={{ padding: compact ? 0 : '0.9rem' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '0.75rem',
          alignItems: 'baseline',
        }}
      >
        <div style={{ fontWeight: 950, fontSize: '1rem' }}>Customer Profile</div>
        {props.checkinStage ? (
          <div className="er-text-sm" style={{ color: '#94a3b8', fontWeight: 900 }}>
            Check-in Stage: {props.checkinStage.number} — {props.checkinStage.label}
          </div>
        ) : null}
      </div>

      <div
        style={{
          marginTop: '0.6rem',
          display: 'grid',
          gridTemplateColumns: compact
            ? 'repeat(auto-fit, minmax(150px, 1fr))'
            : 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: '0.65rem 0.9rem',
          alignItems: 'start',
        }}
      >
        <Detail label="Name" value={props.name || '—'} />
        <Detail label="Preferred Language" value={languageLabel} />
        <Detail label="DOB (MM/DD/YYYY)" value={dobDisplay} />
        <Detail label="ID Type" value={idTypeLabel} />
        <Detail label="ID #" value={props.idNumber || '—'} />
        <Detail
          label="ID Exp (MM/DD/YYYY)"
          value={formatMmDdYyyyFromYyyyMmDd(props.idExpirationDate)}
        />
        <Detail label="Member" value={isMember ? 'Yes' : 'No'} />
        <Detail label="Membership ID" value={props.membershipNumber || '—'} />
        <Detail
          label="Membership Exp (MM/YY)"
          value={isMember ? formatMmYyFromYyyyMmDd(props.membershipValidUntil) : '—'}
        />
        <Detail label="Last Visit (MM/YY)" value={formatMmYyFromTimestamp(props.lastVisitAt)} />
      </div>

      <div style={{ marginTop: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <input
          type="checkbox"
          checked={Boolean(props.hasEncryptedLookupMarker)}
          readOnly
          aria-label="Encrypted Lookup Marker"
        />
        <div className="er-text-sm" style={{ color: '#94a3b8', fontWeight: 800 }}>
          Encrypted Lookup Marker (DL hash)
        </div>
      </div>

      {props.waitlistDesiredTier && props.waitlistBackupType ? (
        <div
          className={compact ? undefined : 'cs-liquid-card'}
          style={{
            marginTop: '0.75rem',
            padding: '0.75rem',
            background: '#fef3c7',
            border: '2px solid #f59e0b',
            borderRadius: '10px',
            color: '#92400e',
          }}
        >
          <div style={{ fontWeight: 900, marginBottom: '0.35rem' }}>Customer Waitlisted</div>
          <div className="er-text-sm" style={{ fontWeight: 800 }}>
            Requested <strong>{props.waitlistDesiredTier}</strong>; backup{' '}
            <strong>{props.waitlistBackupType}</strong>.
          </div>
        </div>
      ) : null}

      {props.footer ? (
        <div style={{ marginTop: '0.85rem', display: 'flex', justifyContent: 'center' }}>
          {props.footer}
        </div>
      ) : null}
    </div>
  );
}
