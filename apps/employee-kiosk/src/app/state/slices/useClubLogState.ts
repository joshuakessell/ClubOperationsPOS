import { useCallback, useEffect, useMemo, useState } from 'react';
import { API_BASE } from '../shared/api';

/**
 * Row shape returned by the unified club-log endpoint (/v1/admin/club-log).
 * Falls back transparently to the legacy activity-log endpoint shape.
 */
export type ClubLogEventRow = {
  id: string;
  occurredAt: string;
  eventType: string;
  eventDomain: string;
  sourceApp: string;
  registerId: string | null;
  staffId: string | null;
  staffName: string | null;
  customerId: string | null;
  customerName: string | null;
  visitId: string | null;
  orderId: string | null;
  amountCents: number | null;
  currency: string;
  summary: string;
  metadata: Record<string, unknown>;
  // Legacy compat fields (mapped if using legacy endpoint)
  actionType?: string;
  actionCategory?: string;
  actor?: { type: string; staffId: string | null; staffName: string | null };
};

/** Shape returned by the legacy /v1/admin/activity-log endpoint */
type LegacyActivityRow = {
  id: string;
  occurredAt: string;
  actionType?: string;
  actionCategory?: string;
  sourceApp?: string;
  actor?: { type: string; staffId: string | null; staffName: string | null };
  customerId?: string | null;
  customerName?: string | null;
  summary?: string;
  metadata?: Record<string, unknown>;
};

type ClubLogResponse = {
  events: ClubLogEventRow[];
  nextCursor: string | null;
  hasMore: boolean;
};

/**
 * Hook that fetches the unified club log.
 *
 * Tries the new /v1/admin/club-log endpoint first; if it 404s (migration not
 * yet applied), falls back to the legacy /v1/admin/activity-log endpoint and
 * normalises the response into the same shape.
 */
export function useClubLogState(params?: { pageSize?: number }) {
  const pageSize = params?.pageSize ?? 60;

  const [items, setItems] = useState<ClubLogEventRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [q, setQ] = useState('');
  const [category, setCategory] = useState<string>('');
  const [domain, setDomain] = useState<string>('');
  const [staffId, setStaffId] = useState<string>('');
  const [registerId, setRegisterId] = useState<string>('');
  const [fromIso, setFromIso] = useState<string>('');
  const [toIso, setToIso] = useState<string>('');

  // Whether we should use the legacy endpoint
  const [useLegacy, setUseLegacy] = useState(false);

  // Build query string for the unified endpoint
  const queryString = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set('limit', String(pageSize));
    if (q.trim()) sp.set('search', q.trim());
    if (domain) sp.set('domain', domain);
    if (category) sp.set('eventType', category);
    if (staffId) sp.set('staffId', staffId);
    if (registerId) sp.set('registerId', registerId);
    if (fromIso) sp.set('from', fromIso);
    if (toIso) sp.set('to', toIso);
    return sp.toString();
  }, [pageSize, q, domain, category, staffId, registerId, fromIso, toIso]);

  // Build legacy query string (fallback)
  const legacyQueryString = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set('limit', String(pageSize));
    if (q.trim()) sp.set('q', q.trim());
    if (category) sp.set('actionCategory', category);
    if (fromIso) sp.set('from', fromIso);
    if (toIso) sp.set('to', toIso);
    return sp.toString();
  }, [pageSize, q, category, fromIso, toIso]);

  // Normalise a legacy activity-log row into ClubLogEventRow
  const normaliseLegacyRow = useCallback(
    (row: LegacyActivityRow): ClubLogEventRow => ({
      id: row.id,
      occurredAt: row.occurredAt,
      eventType: row.actionType ?? '',
      eventDomain: row.actionCategory ?? '',
      sourceApp: row.sourceApp ?? '',
      registerId: null,
      staffId: row.actor?.staffId ?? null,
      staffName: row.actor?.staffName ?? null,
      customerId: row.customerId ?? null,
      customerName: row.customerName ?? null,
      visitId: null,
      orderId: null,
      amountCents: null,
      currency: 'USD',
      summary: row.summary ?? '',
      metadata: row.metadata ?? {},
      actionType: row.actionType,
      actionCategory: row.actionCategory,
      actor: row.actor,
    }),
    [],
  );

  const fetchPage = useCallback(
    async (cursor?: string) => {
      setLoading(true);
      setError(null);

      try {
        // Try unified endpoint first
        if (!useLegacy) {
          const sp = new URLSearchParams(queryString);
          if (cursor) sp.set('cursor', cursor);

          const res = await fetch(`${API_BASE}/v1/admin/club-log?${sp.toString()}`, {
            credentials: 'include',
          });

          if (res.ok) {
            const json = (await res.json()) as ClubLogResponse;
            return { events: json.events ?? [], nextCursor: json.nextCursor ?? null };
          }

          // If 404 → migration not applied yet, fall back to legacy
          if (res.status === 404) {
            setUseLegacy(true);
          } else {
            throw new Error(`Failed to load club log (${res.status})`);
          }
        }

        // Legacy fallback
        const sp = new URLSearchParams(legacyQueryString);
        if (cursor) sp.set('cursor', cursor);
        const res = await fetch(`${API_BASE}/v1/admin/activity-log?${sp.toString()}`, {
          credentials: 'include',
        });
        if (!res.ok) throw new Error(`Failed to load activity log (${res.status})`);
        const json = (await res.json()) as { events: LegacyActivityRow[]; nextCursor: string | null };
        const events = (json.events ?? []).map(normaliseLegacyRow);
        return { events, nextCursor: json.nextCursor ?? null };
      } finally {
        setLoading(false);
      }
    },
    [useLegacy, queryString, legacyQueryString, normaliseLegacyRow],
  );

  const loadFirstPage = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchPage();
      setItems(result.events);
      setNextCursor(result.nextCursor);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
      setItems([]);
      setNextCursor(null);
    } finally {
      setLoading(false);
    }
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loading) return;
    setLoading(true);
    try {
      const result = await fetchPage(nextCursor);
      setItems((prev) => [...prev, ...result.events]);
      setNextCursor(result.nextCursor);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [nextCursor, loading, fetchPage]);

  useEffect(() => {
    void loadFirstPage();
  }, [loadFirstPage]);

  return {
    items,
    nextCursor,
    loading,
    error,
    q,
    category,
    domain,
    staffId,
    registerId,
    fromIso,
    toIso,
    setQ,
    setCategory,
    setDomain,
    setStaffId,
    setRegisterId,
    setFromIso,
    setToIso,
    reload: loadFirstPage,
    loadMore,
  };
}
