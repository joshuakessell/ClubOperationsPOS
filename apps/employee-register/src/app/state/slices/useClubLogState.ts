import { useCallback, useEffect, useMemo, useState } from 'react';
import { API_BASE } from '../shared/api';

type ActivityEventRow = {
  id: string;
  occurredAt: string;
  customerId: string;
  customerName: string;
  actionType: string;
  actionCategory: string;
  sourceApp: string;
  actor: {
    type: 'STAFF' | 'CUSTOMER' | 'SYSTEM';
    staffId: string | null;
    staffName: string | null;
  };
  summary: string;
  metadata: unknown;
};

type ActivityLogResponse = {
  events: ActivityEventRow[];
  nextCursor: string | null;
};

export function useClubLogState(params?: { pageSize?: number }) {
  const pageSize = params?.pageSize ?? 60;

  const [items, setItems] = useState<ActivityEventRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState('');
  const [category, setCategory] = useState<string>('');
  const [fromIso, setFromIso] = useState<string>('');
  const [toIso, setToIso] = useState<string>('');

  const queryString = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set('limit', String(pageSize));
    if (q.trim()) sp.set('q', q.trim());
    if (category) sp.set('actionCategory', category);
    if (fromIso) sp.set('from', fromIso);
    if (toIso) sp.set('to', toIso);
    return sp.toString();
  }, [pageSize, q, category, fromIso, toIso]);

  const loadFirstPage = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/v1/admin/activity-log?${queryString}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`Failed to load club log (${res.status})`);
      const json = (await res.json()) as ActivityLogResponse;
      setItems(json.events ?? []);
      setNextCursor(json.nextCursor ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
      setItems([]);
      setNextCursor(null);
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loading) return;
    setLoading(true);
    setError(null);
    try {
      const sp = new URLSearchParams(queryString);
      sp.set('cursor', nextCursor);
      const res = await fetch(`${API_BASE}/v1/admin/activity-log?${sp.toString()}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`Failed to load more (${res.status})`);
      const json = (await res.json()) as ActivityLogResponse;
      setItems((prev) => [...prev, ...(json.events ?? [])]);
      setNextCursor(json.nextCursor ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [nextCursor, loading, queryString]);

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
    fromIso,
    toIso,
    setQ,
    setCategory,
    setFromIso,
    setToIso,
    reload: loadFirstPage,
    loadMore,
  };
}
