import type { CustomerIdType } from '@club-ops/shared';

const AAMVA_CODES = new Set([
  'DCS',
  'DAC',
  'DAD',
  'DAA',
  'DBB',
  'DBD',
  'DAQ',
  'DAJ',
  'DCI',
  'DDE',
  'DDF',
  'DDG',
  'DBA',
  'DBC',
  'DCA',
  'DCB',
  'DCD',
  'DCF',
  'DCG',
  'DCK',
  'DCL',
  'DDA',
  'DDB',
  'DDC',
  'DDD',
  'DAG',
  'DAI',
  'DAK',
  'DAR',
  'DAS',
  'DAT',
  'DAU',
]);

export type ExtractedAamvaIdentity = {
  firstName?: string;
  lastName?: string;
  fullName?: string;
  dob?: string;
  idExpirationDate?: string;
  idNumber?: string;
  issuer?: string;
  jurisdiction?: string;
  idType?: CustomerIdType;
  idTypeOther?: string;
};

export type AamvaActiveField =
  | 'firstName'
  | 'lastName'
  | 'dob'
  | 'idExpirationDate'
  | 'idNumber';

export function normalizeScanText(raw: string): string {
  if (!raw) return '';
  const cleaned = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  return cleaned
    .split('\n')
    .filter((line) => line.trim().toUpperCase() !== 'ZTZTAN')
    .join('\n')
    .trim();
}

export function isLikelyAamvaPdf417Text(raw: string): boolean {
  const s = raw;
  return (
    s.startsWith('@') ||
    s.includes('ANSI ') ||
    s.includes('AAMVA') ||
    /\nDCS/.test(s) ||
    /\nDAC/.test(s) ||
    /\nDBD/.test(s) ||
    /\nDAQ/.test(s)
  );
}

function extractAamvaFieldMap(rawNormalized: string): Record<string, string> {
  const s = rawNormalized;
  const hits: Array<{ code: string; idx: number }> = [];

  for (let i = 0; i <= s.length - 3; i++) {
    const code = s.slice(i, i + 3);
    if (AAMVA_CODES.has(code)) {
      hits.push({ code, idx: i });
    }
  }

  hits.sort((a, b) => a.idx - b.idx);

  const out: Record<string, string> = {};
  for (let i = 0; i < hits.length; i++) {
    const cur = hits[i]!;
    const nextIdx = hits[i + 1]?.idx ?? s.length;
    const rawValue = s.slice(cur.idx + 3, nextIdx);
    const value = rawValue.replace(/\s+/g, ' ').trim();
    if (!value) continue;

    const existing = out[cur.code];
    if (!existing) {
      out[cur.code] = value;
      continue;
    }
    if (value.length > existing.length) out[cur.code] = value;
  }

  return out;
}

function inferAamvaIdType(fieldMap: Record<string, string>): CustomerIdType | undefined {
  const normalize = (value: string | undefined) => (value || '').trim().toUpperCase();
  const classValue = normalize(fieldMap['DCA']);
  const restrictions = normalize(fieldMap['DCB']);
  const endorsements = normalize(fieldMap['DCD']);
  const licenseSignals = [classValue, restrictions, endorsements].filter(Boolean);
  const hasLicenseSignal = licenseSignals.some(
    (value) => !['NONE', 'N/A', 'NA', 'ID', 'IDENTIFICATION'].includes(value)
  );
  return hasLicenseSignal ? 'DRIVERS_LICENSE' : 'STATE_ID';
}

function parseAamvaDateToISO(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const digits = value.replace(/\D/g, '');
  if (!/^\d{8}$/.test(digits)) return undefined;

  const tryYyyyMmDd = () => {
    const yyyy = Number(digits.slice(0, 4));
    const mm = Number(digits.slice(4, 6));
    const dd = Number(digits.slice(6, 8));
    if (yyyy < 1900 || yyyy > 2100) return undefined;
    if (mm < 1 || mm > 12) return undefined;
    if (dd < 1 || dd > 31) return undefined;
    return `${String(yyyy).padStart(4, '0')}-${String(mm).padStart(2, '0')}-${String(dd).padStart(
      2,
      '0'
    )}`;
  };

  const tryMmDdYyyy = () => {
    const mm = Number(digits.slice(0, 2));
    const dd = Number(digits.slice(2, 4));
    const yyyy = Number(digits.slice(4, 8));
    if (yyyy < 1900 || yyyy > 2100) return undefined;
    if (mm < 1 || mm > 12) return undefined;
    if (dd < 1 || dd > 31) return undefined;
    return `${String(yyyy).padStart(4, '0')}-${String(mm).padStart(2, '0')}-${String(dd).padStart(
      2,
      '0'
    )}`;
  };

  const yyyy = Number(digits.slice(0, 4));
  if (yyyy >= 1900 && yyyy <= 2100) {
    return tryYyyyMmDd() ?? tryMmDdYyyy();
  }
  return tryMmDdYyyy() ?? tryYyyyMmDd();
}

export function extractAamvaIdentity(rawNormalized: string): ExtractedAamvaIdentity {
  const fieldMap = extractAamvaFieldMap(rawNormalized);
  const firstName = fieldMap['DAC']?.trim();
  const lastName = fieldMap['DCS']?.trim();
  const fullName = fieldMap['DAA']?.trim();
  const dob = parseAamvaDateToISO(fieldMap['DBB']);
  const idExpirationDate = parseAamvaDateToISO(fieldMap['DBA']);
  const idNumber = fieldMap['DAQ']?.trim();
  const issuer = fieldMap['DCI']?.trim();
  const jurisdiction = fieldMap['DAJ']?.trim();
  const idType = inferAamvaIdType(fieldMap);

  return {
    firstName,
    lastName,
    fullName,
    dob,
    idExpirationDate,
    idNumber,
    issuer,
    jurisdiction,
    idType,
  };
}

const ACTIVE_MARKERS: Array<{ code: string; field: AamvaActiveField }> = [
  { code: 'DAC', field: 'firstName' },
  { code: 'DCS', field: 'lastName' },
  { code: 'DBB', field: 'dob' },
  { code: 'DBA', field: 'idExpirationDate' },
  { code: 'DAQ', field: 'idNumber' },
];

export function getAamvaActiveField(rawNormalized: string): AamvaActiveField | null {
  let active: AamvaActiveField | null = null;
  let lastIdx = -1;
  for (const marker of ACTIVE_MARKERS) {
    const idx = rawNormalized.lastIndexOf(marker.code);
    if (idx > lastIdx) {
      lastIdx = idx;
      active = marker.field;
    }
  }
  return active;
}
