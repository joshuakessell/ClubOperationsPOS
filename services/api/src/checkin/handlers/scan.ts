import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Parse as ParseAamva } from 'aamva-parser';

import { transaction } from '../../db/index.js';
import { requireAuth } from '../../auth/middleware.js';
import type { PoolClient } from '../types.js';
import {
  computeSha256Hex,
  normalizeScanText,
  parseMembershipNumber,
  toDate,
} from '../service.js';

function isLikelyAamvaPdf417Text(raw: string): boolean {
  // Heuristic detection for AAMVA DL/ID text payloads.
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

type ExtractedIdIdentity = {
  firstName?: string;
  lastName?: string;
  fullName?: string;
  dob?: string; // YYYY-MM-DD
  idNumber?: string;
  issuer?: string;
  jurisdiction?: string;
};

const AAMVA_CODES = new Set([
  // core identity fields
  'DCS',
  'DAC',
  'DAD',
  'DAA',
  'DBB',
  'DBD',
  'DAQ',
  'DAJ',
  'DCI',
  // common truncation/flags that often appear between name fields
  'DDE',
  'DDF',
  'DDG',
  // other common fields that can appear and must be treated as boundaries
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

function extractAamvaFieldMap(raw: string): Record<string, string> {
  // Scan raw (already normalized) for occurrences of known AAMVA 3-letter codes.
  // Record positions and slice values between consecutive codes.
  // Trim whitespace/newlines from values.
  // If a code appears multiple times, keep the first non-empty value (or prefer the longest non-empty).
  const s = raw;
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
    // Prefer longest non-empty (helps when a code repeats with a fuller value).
    if (value.length > existing.length) out[cur.code] = value;
  }

  return out;
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
    return `${String(yyyy).padStart(4, '0')}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
  };

  const tryMmDdYyyy = () => {
    const mm = Number(digits.slice(0, 2));
    const dd = Number(digits.slice(2, 4));
    const yyyy = Number(digits.slice(4, 8));
    if (yyyy < 1900 || yyyy > 2100) return undefined;
    if (mm < 1 || mm > 12) return undefined;
    if (dd < 1 || dd > 31) return undefined;
    return `${String(yyyy).padStart(4, '0')}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
  };

  // First try YYYYMMDD if year looks plausible, otherwise MMDDYYYY.
  const yyyy = Number(digits.slice(0, 4));
  if (yyyy >= 1900 && yyyy <= 2100) {
    return tryYyyyMmDd() ?? tryMmDdYyyy();
  }
  return tryMmDdYyyy() ?? tryYyyyMmDd();
}

function isCleanParsedAamvaValue(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const s = value.trim();
  if (!s) return false;
  if (s.length > 64) return false;
  // Guard against concatenated AAMVA codes leaking into parsed strings.
  if (/(?:^|[^A-Z])D[A-Z]{2}(?:[^A-Z]|$)/.test(s)) return false;
  if (/\b(DAQ|DBB|DBD|DCS|DAC|DAA|DAJ|DCI)\b/.test(s)) return false;
  return true;
}

function extractAamvaIdentity(rawNormalized: string): ExtractedIdIdentity {
  const fieldMap = extractAamvaFieldMap(rawNormalized);
  const fromMap: ExtractedIdIdentity = {
    lastName: fieldMap['DCS'] || undefined,
    firstName: fieldMap['DAC'] || undefined,
    fullName: fieldMap['DAA'] || undefined,
    dob: parseAamvaDateToISO(fieldMap['DBB']) || parseAamvaDateToISO(fieldMap['DBD']) || undefined,
    idNumber: fieldMap['DAQ'] || undefined,
    jurisdiction: fieldMap['DAJ'] || fieldMap['DCI'] || undefined,
    issuer: fieldMap['DAJ'] || fieldMap['DCI'] || undefined,
  };

  if (!fromMap.fullName && fromMap.firstName && fromMap.lastName) {
    fromMap.fullName = `${fromMap.firstName} ${fromMap.lastName}`.trim();
  }

  try {
    const parsed = ParseAamva(rawNormalized) as unknown as {
      firstName?: string | null;
      lastName?: string | null;
      dateOfBirth?: Date | string | null;
      driversLicenseId?: string | null;
      state?: string | null;
      pdf417?: string | null;
    };

    // Only trust parsed values if they look clean AND we are missing that field from fieldMap.
    const parsedDob =
      parsed?.dateOfBirth instanceof Date
        ? parsed.dateOfBirth.toISOString().slice(0, 10)
        : typeof parsed?.dateOfBirth === 'string'
          ? parseAamvaDateToISO(parsed.dateOfBirth)
          : undefined;

    const out: ExtractedIdIdentity = { ...fromMap };
    if (!out.firstName && isCleanParsedAamvaValue(parsed?.firstName)) out.firstName = parsed.firstName!.trim();
    if (!out.lastName && isCleanParsedAamvaValue(parsed?.lastName)) out.lastName = parsed.lastName!.trim();
    if (!out.idNumber && isCleanParsedAamvaValue(parsed?.driversLicenseId))
      out.idNumber = parsed.driversLicenseId!.trim();
    if (!out.jurisdiction && isCleanParsedAamvaValue(parsed?.state)) out.jurisdiction = parsed.state!.trim();
    if (!out.issuer && isCleanParsedAamvaValue(parsed?.state)) out.issuer = parsed.state!.trim();
    if (!out.dob && parsedDob) out.dob = parsedDob;
    if (!out.fullName && out.firstName && out.lastName) out.fullName = `${out.firstName} ${out.lastName}`.trim();
    return out;
  } catch {
    return fromMap;
  }
}

type NormalizedNameParts = {
  normalizedFull: string;
  firstToken: string;
  lastToken: string;
};

function normalizePersonNameForMatch(input: string): string {
  // Rules:
  // - lower-case
  // - trim
  // - remove punctuation (keep letters, numbers, spaces)
  // - collapse whitespace
  // - remove common suffix tokens at end: jr, sr, ii, iii, iv
  const lowered = input.toLowerCase().trim();
  const noPunct = lowered.replace(/[^a-z0-9 ]+/g, ' ');
  const collapsed = noPunct.replace(/\s+/g, ' ').trim();
  if (!collapsed) return '';
  const tokens = collapsed.split(' ').filter(Boolean);
  const suffixes = new Set(['jr', 'sr', 'ii', 'iii', 'iv']);
  while (tokens.length > 1 && suffixes.has(tokens[tokens.length - 1]!)) {
    tokens.pop();
  }
  return tokens.join(' ');
}

function splitNamePartsForMatch(input: string): NormalizedNameParts | null {
  const normalizedFull = normalizePersonNameForMatch(input);
  if (!normalizedFull) return null;
  const tokens = normalizedFull.split(' ').filter(Boolean);
  if (tokens.length === 0) return null;
  const firstToken = tokens[0]!;
  const lastToken = tokens[tokens.length - 1]!;
  return { normalizedFull, firstToken, lastToken };
}

function jaroWinklerSimilarity(aRaw: string, bRaw: string): number {
  // Deterministic lightweight string similarity. Returns 0..1.
  const a = aRaw;
  const b = bRaw;
  if (a === b) return a.length === 0 ? 0 : 1;
  const aLen = a.length;
  const bLen = b.length;
  if (aLen === 0 || bLen === 0) return 0;

  const matchDistance = Math.max(0, Math.floor(Math.max(aLen, bLen) / 2) - 1);
  const aMatches = new Array<boolean>(aLen).fill(false);
  const bMatches = new Array<boolean>(bLen).fill(false);

  let matches = 0;
  for (let i = 0; i < aLen; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, bLen);
    for (let j = start; j < end; j++) {
      if (bMatches[j]) continue;
      if (a[i] !== b[j]) continue;
      aMatches[i] = true;
      bMatches[j] = true;
      matches++;
      break;
    }
  }
  if (matches === 0) return 0;

  let t = 0;
  let k = 0;
  for (let i = 0; i < aLen; i++) {
    if (!aMatches[i]) continue;
    while (k < bLen && !bMatches[k]) k++;
    if (k < bLen && a[i] !== b[k]) t++;
    k++;
  }
  const transpositions = t / 2;

  const jaro = (matches / aLen + matches / bLen + (matches - transpositions) / matches) / 3;

  // Winkler adjustment
  const prefixMax = 4;
  let prefix = 0;
  for (let i = 0; i < Math.min(prefixMax, aLen, bLen); i++) {
    if (a[i] === b[i]) prefix++;
    else break;
  }
  const p = 0.1;
  const jw = jaro + prefix * p * (1 - jaro);
  return Math.max(0, Math.min(1, jw));
}

const FUZZY_MIN_OVERALL = 0.88;
const FUZZY_MIN_LAST = 0.9;
const FUZZY_MIN_FIRST = 0.85;

function scoreNameMatch(params: {
  scannedFirst: string;
  scannedLast: string;
  storedFirst: string;
  storedLast: string;
}): {
  score: number;
  firstMax: number;
  lastMax: number;
} {
  const firstDirect = jaroWinklerSimilarity(params.scannedFirst, params.storedFirst);
  const lastDirect = jaroWinklerSimilarity(params.scannedLast, params.storedLast);
  const direct = (firstDirect + lastDirect) / 2;

  const firstSwapped = jaroWinklerSimilarity(params.scannedFirst, params.storedLast);
  const lastSwapped = jaroWinklerSimilarity(params.scannedLast, params.storedFirst);
  const swapped = (firstSwapped + lastSwapped) / 2;

  const score = Math.max(direct, swapped);
  const firstMax = Math.max(firstDirect, firstSwapped);
  const lastMax = Math.max(lastDirect, lastSwapped);
  return { score, firstMax, lastMax };
}

function passesFuzzyThresholds(score: { score: number; firstMax: number; lastMax: number }): boolean {
  return (
    score.score >= FUZZY_MIN_OVERALL &&
    score.lastMax >= FUZZY_MIN_LAST &&
    score.firstMax >= FUZZY_MIN_FIRST
  );
}

async function maybeAttachScanIdentifiers(params: {
  client: PoolClient;
  customerId: string;
  existingIdScanHash: string | null;
  existingIdScanValue: string | null;
  idScanHash: string;
  idScanValue: string;
}): Promise<void> {
  if (params.existingIdScanHash && params.existingIdScanValue) return;
  await params.client.query(
    `UPDATE customers
     SET id_scan_hash = COALESCE(id_scan_hash, $1),
         id_scan_value = COALESCE(id_scan_value, $2),
         updated_at = NOW()
     WHERE id = $3
       AND (id_scan_hash IS NULL OR id_scan_value IS NULL)`,
    [params.idScanHash, params.idScanValue, params.customerId]
  );
}

export async function registerCheckinScanRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /v1/checkin/scan
   *
   * Server-side scan normalization, classification, parsing, and customer matching.
   * Input: { laneId, rawScanText }
   *
   * Returns one of:
   * - MATCHED: customer record (and enrichment applied if match was via name+DOB)
   * - NO_MATCH: extracted identity payload for prefill (ID scans) or membership candidate (non-ID)
   * - ERROR: banned / invalid scan / auth error
   */
  const CheckinScanBodySchema = z.object({
    laneId: z.string().min(1),
    rawScanText: z.string().min(1),
    selectedCustomerId: z.string().uuid().optional(),
  });

  fastify.post('/v1/checkin/scan', { preHandler: [requireAuth] }, async (request, reply) => {
    if (!request.staff) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    let body: z.infer<typeof CheckinScanBodySchema>;
    try {
      body = CheckinScanBodySchema.parse(request.body);
    } catch (error) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: error instanceof z.ZodError ? error.errors : 'Invalid input',
      });
    }

    const normalized = normalizeScanText(body.rawScanText);
    if (!normalized) {
      return reply.status(400).send({
        result: 'ERROR',
        error: { code: 'INVALID_SCAN', message: 'Empty scan input' },
      });
    }

    const isAamva = isLikelyAamvaPdf417Text(normalized);
    if (body.selectedCustomerId && !isAamva) {
      return reply.status(400).send({
        result: 'ERROR',
        error: { code: 'INVALID_SELECTION', message: 'Selected customer does not match this scan' },
      });
    }

    try {
      const result = await transaction(async (client) => {
        type CustomerIdentityRow = {
          id: string;
          name: string;
          dob: Date | null;
          membership_number: string | null;
          banned_until: Date | null;
          id_scan_hash: string | null;
          id_scan_value: string | null;
        };

        const checkBanned = (row: CustomerIdentityRow) => {
          const bannedUntil = toDate(row.banned_until);
          if (bannedUntil && bannedUntil > new Date()) {
            throw {
              statusCode: 403,
              code: 'BANNED',
              message: `Customer is banned until ${bannedUntil.toISOString()}`,
            };
          }
        };

        if (isAamva) {
          const extracted = extractAamvaIdentity(normalized);
          const idScanValue = normalized;
          const idScanHash = computeSha256Hex(idScanValue);

          // Employee-choice resolution (step after MULTIPLE_MATCHES)
          if (body.selectedCustomerId) {
            const selected = await client.query<CustomerIdentityRow>(
              `SELECT id, name, dob, membership_number, banned_until, id_scan_hash, id_scan_value
               FROM customers
               WHERE id = $1
               LIMIT 1`,
              [body.selectedCustomerId]
            );
            if (selected.rows.length === 0) {
              throw {
                statusCode: 400,
                code: 'INVALID_SELECTION',
                message: 'Selected customer does not match this scan',
              };
            }
            const chosen = selected.rows[0]!;

            // Only allow selection resolution when scan has the identity fields needed.
            if (!extracted.dob || !extracted.firstName || !extracted.lastName) {
              throw {
                statusCode: 400,
                code: 'INVALID_SELECTION',
                message: 'Selected customer does not match this scan',
              };
            }

            const chosenDob = chosen.dob ? chosen.dob.toISOString().slice(0, 10) : null;
            if (chosenDob !== extracted.dob) {
              throw {
                statusCode: 400,
                code: 'INVALID_SELECTION',
                message: 'Selected customer does not match this scan',
              };
            }

            const scannedParts = splitNamePartsForMatch(`${extracted.firstName} ${extracted.lastName}`.trim());
            const storedParts = splitNamePartsForMatch(chosen.name);
            if (!scannedParts || !storedParts) {
              throw {
                statusCode: 400,
                code: 'INVALID_SELECTION',
                message: 'Selected customer does not match this scan',
              };
            }

            const fuzzy = scoreNameMatch({
              scannedFirst: scannedParts.firstToken,
              scannedLast: scannedParts.lastToken,
              storedFirst: storedParts.firstToken,
              storedLast: storedParts.lastToken,
            });
            if (!passesFuzzyThresholds(fuzzy)) {
              throw {
                statusCode: 400,
                code: 'INVALID_SELECTION',
                message: 'Selected customer does not match this scan',
              };
            }

            checkBanned(chosen);
            await maybeAttachScanIdentifiers({
              client,
              customerId: chosen.id,
              existingIdScanHash: chosen.id_scan_hash,
              existingIdScanValue: chosen.id_scan_value,
              idScanHash,
              idScanValue,
            });

            return {
              result: 'MATCHED' as const,
              scanType: 'STATE_ID' as const,
              normalizedRawScanText: idScanValue,
              idScanHash,
              customer: {
                id: chosen.id,
                name: chosen.name,
                dob: chosen.dob ? chosen.dob.toISOString().slice(0, 10) : null,
                membershipNumber: chosen.membership_number,
              },
              extracted,
              enriched: Boolean(!chosen.id_scan_hash || !chosen.id_scan_value),
            };
          }

          // Matching order:
          // 1) customers.id_scan_hash OR customers.id_scan_value
          const byHashOrValue = await client.query<CustomerIdentityRow>(
            `SELECT id, name, dob, membership_number, banned_until, id_scan_hash, id_scan_value
             FROM customers
             WHERE id_scan_hash = $1 OR id_scan_value = $2
             LIMIT 2`,
            [idScanHash, idScanValue]
          );

          if (byHashOrValue.rows.length > 0) {
            const matched = byHashOrValue.rows.find((r) => r.id_scan_hash === idScanHash) ?? byHashOrValue.rows[0]!;

            checkBanned(matched);

            // Ensure both identifiers are persisted for future instant matches.
            await maybeAttachScanIdentifiers({
              client,
              customerId: matched.id,
              existingIdScanHash: matched.id_scan_hash,
              existingIdScanValue: matched.id_scan_value,
              idScanHash,
              idScanValue,
            });

            return {
              result: 'MATCHED' as const,
              scanType: 'STATE_ID' as const,
              normalizedRawScanText: idScanValue,
              idScanHash,
              customer: {
                id: matched.id,
                name: matched.name,
                dob: matched.dob ? matched.dob.toISOString().slice(0, 10) : null,
                membershipNumber: matched.membership_number,
              },
              extracted,
              enriched: false,
            };
          }

          // 2) fallback match by (first_name,last_name,birthdate) normalized
          if (extracted.firstName && extracted.lastName && extracted.dob) {
            // Compare against customers.dob (DATE) using an explicit date cast to avoid timezone issues.
            const dobStr = extracted.dob;
            if (/^\\d{4}-\\d{2}-\\d{2}$/.test(dobStr)) {
              const byNameDob = await client.query<CustomerIdentityRow>(
                `SELECT id, name, dob, membership_number, banned_until, id_scan_hash, id_scan_value
                 FROM customers
                 WHERE dob = $1::date
                   AND lower(split_part(name, ' ', 1)) = lower($2)
                   AND lower(regexp_replace(name, '^.*\\s', '')) = lower($3)
                 LIMIT 2`,
                [dobStr, extracted.firstName, extracted.lastName]
              );

              if (byNameDob.rows.length > 0) {
                const matched = byNameDob.rows[0]!;
                checkBanned(matched);

                // Enrich customer for future instant matches
                await maybeAttachScanIdentifiers({
                  client,
                  customerId: matched.id,
                  existingIdScanHash: matched.id_scan_hash,
                  existingIdScanValue: matched.id_scan_value,
                  idScanHash,
                  idScanValue,
                });

                return {
                  result: 'MATCHED' as const,
                  scanType: 'STATE_ID' as const,
                  normalizedRawScanText: idScanValue,
                  idScanHash,
                  customer: {
                    id: matched.id,
                    name: matched.name,
                    dob: matched.dob ? matched.dob.toISOString().slice(0, 10) : null,
                    membershipNumber: matched.membership_number,
                  },
                  extracted,
                  enriched: Boolean(!matched.id_scan_hash || !matched.id_scan_value),
                };
              }

              // 2b) fuzzy match: exact DOB filter in SQL, then deterministic similarity in app code
              const scannedParts = splitNamePartsForMatch(`${extracted.firstName} ${extracted.lastName}`.trim());
              if (scannedParts) {
                const candidatesByDob = await client.query<CustomerIdentityRow>(
                  `SELECT id, name, dob, membership_number, banned_until, id_scan_hash, id_scan_value
                   FROM customers
                   WHERE dob = $1::date
                   LIMIT 200`,
                  [dobStr]
                );

                const scored = candidatesByDob.rows
                  .map((row) => {
                    const storedParts = splitNamePartsForMatch(row.name);
                    if (!storedParts) return null;
                    const s = scoreNameMatch({
                      scannedFirst: scannedParts.firstToken,
                      scannedLast: scannedParts.lastToken,
                      storedFirst: storedParts.firstToken,
                      storedLast: storedParts.lastToken,
                    });
                    return { row, score: s };
                  })
                  .filter(
                    (
                      x
                    ): x is {
                      row: CustomerIdentityRow;
                      score: { score: number; firstMax: number; lastMax: number };
                    } => Boolean(x && passesFuzzyThresholds(x.score))
                  )
                  .sort((a, b) => b.score.score - a.score.score);

                if (scored.length === 1) {
                  const matched = scored[0]!.row;
                  checkBanned(matched);
                  await maybeAttachScanIdentifiers({
                    client,
                    customerId: matched.id,
                    existingIdScanHash: matched.id_scan_hash,
                    existingIdScanValue: matched.id_scan_value,
                    idScanHash,
                    idScanValue,
                  });
                  return {
                    result: 'MATCHED' as const,
                    scanType: 'STATE_ID' as const,
                    normalizedRawScanText: idScanValue,
                    idScanHash,
                    customer: {
                      id: matched.id,
                      name: matched.name,
                      dob: matched.dob ? matched.dob.toISOString().slice(0, 10) : null,
                      membershipNumber: matched.membership_number,
                    },
                    extracted,
                    enriched: Boolean(!matched.id_scan_hash || !matched.id_scan_value),
                  };
                }

                if (scored.length > 1) {
                  return {
                    result: 'MULTIPLE_MATCHES' as const,
                    scanType: 'STATE_ID' as const,
                    normalizedRawScanText: idScanValue,
                    idScanHash,
                    extracted,
                    candidates: scored.slice(0, 10).map(({ row, score }) => ({
                      id: row.id,
                      name: row.name,
                      dob: row.dob ? row.dob.toISOString().slice(0, 10) : null,
                      membershipNumber: row.membership_number,
                      matchScore: score.score,
                    })),
                  };
                }
              }
            }
          }

          // 3) no match: return extracted identity for prefill
          return {
            result: 'NO_MATCH' as const,
            scanType: 'STATE_ID' as const,
            normalizedRawScanText: idScanValue,
            idScanHash,
            extracted,
          };
        }

        // Non-state-ID: treat as membership/general barcode
        const membershipCandidate = parseMembershipNumber(normalized) || normalized;

        const byMembership = await client.query<CustomerIdentityRow>(
          `SELECT id, name, dob, membership_number, banned_until, id_scan_hash, id_scan_value
           FROM customers
           WHERE membership_number = $1
           LIMIT 1`,
          [membershipCandidate]
        );

        if (byMembership.rows.length > 0) {
          const matched = byMembership.rows[0]!;
          checkBanned(matched);
          return {
            result: 'MATCHED' as const,
            scanType: 'MEMBERSHIP' as const,
            normalizedRawScanText: normalized,
            membershipNumber: matched.membership_number,
            customer: {
              id: matched.id,
              name: matched.name,
              dob: matched.dob ? matched.dob.toISOString().slice(0, 10) : null,
              membershipNumber: matched.membership_number,
            },
          };
        }

        return {
          result: 'NO_MATCH' as const,
          scanType: 'MEMBERSHIP' as const,
          normalizedRawScanText: normalized,
          membershipCandidate,
        };
      });

      return reply.send(result);
    } catch (error) {
      request.log.error(error, 'Failed to process checkin scan');
      if (error && typeof error === 'object' && 'statusCode' in error) {
        const statusCode = (error as { statusCode: number }).statusCode;
        const code = (error as { code?: string }).code;
        const message = (error as { message?: string }).message;
        return reply.status(statusCode).send({
          result: 'ERROR',
          error: { code: code || 'ERROR', message: message || 'Failed to process scan' },
        });
      }
      return reply.status(500).send({
        result: 'ERROR',
        error: { code: 'INTERNAL', message: 'Failed to process scan' },
      });
    }
  });
}

