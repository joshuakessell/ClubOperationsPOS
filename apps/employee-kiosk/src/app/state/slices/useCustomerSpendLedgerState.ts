import { useCallback, useMemo, useState } from 'react';
import { getErrorMessage } from '@club-ops/ui';
import { API_BASE } from '../shared/api';
import type { StaffSession } from '../shared/types';
import type { ToastNotifier } from '../shared/notifications';

export type SpendLedgerGroup = {
  visitId: string | null;
  visitStartedAt: string | null;
  visitEndedAt: string | null;
  grossCents: number;
  refundsCents: number;
  netCents: number;
  entryCount: number;
};

export type SpendLedgerEntry = {
  id: string;
  occurredAt: string;
  entryType: string;
  amountCents: number;
  currency: string;
  summary: string;
  metadata: unknown;
};

type SpendLedgerGroupsResponse = {
  groups: SpendLedgerGroup[];
  nextCursor: string | null;
};

type SpendLedgerEntriesResponse = {
  entries: SpendLedgerEntry[];
  totals: { grossCents: number; refundsCents: number; netCents: number };
};

type Params = {
  session: StaffSession | null;
  notifications: ToastNotifier;
};

export function useCustomerSpendLedgerState({ session, notifications }: Params) {
  const [groupsByCustomerId, setGroupsByCustomerId] = useState<Record<string, SpendLedgerGroup[]>>(
    {}
  );
  const [entriesByVisitKey, setEntriesByVisitKey] = useState<Record<string, SpendLedgerEntry[]>>(
    {}
  );
  const [loadingByCustomerId, setLoadingByCustomerId] = useState<Record<string, boolean>>({});
  const [errorByCustomerId, setErrorByCustomerId] = useState<Record<string, string | null>>({});
  const [loadedByCustomerId, setLoadedByCustomerId] = useState<Record<string, boolean>>({});

  const loadSpendLedger = useCallback(
    async (customerId: string) => {
      if (!session?.sessionToken) return;
      setLoadingByCustomerId((p) => ({ ...p, [customerId]: true }));
      setErrorByCustomerId((p) => ({ ...p, [customerId]: null }));
      try {
        const res = await fetch(`${API_BASE}/v1/customers/${customerId}/spend-ledger?limit=50`, {
          headers: { Authorization: `Bearer ${session.sessionToken}` },
        });
        if (!res.ok) {
          const payload: unknown = await res.json().catch(() => null);
          throw new Error(getErrorMessage(payload) || 'Failed to load spend ledger');
        }
        const data = (await res.json()) as SpendLedgerGroupsResponse;
        const groups = Array.isArray(data.groups) ? data.groups : [];
        setGroupsByCustomerId((p) => ({ ...p, [customerId]: groups }));
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to load spend ledger';
        setErrorByCustomerId((p) => ({ ...p, [customerId]: msg }));
        notifications.warn(msg);
      } finally {
        setLoadingByCustomerId((p) => ({ ...p, [customerId]: false }));
        setLoadedByCustomerId((p) => ({ ...p, [customerId]: true }));
      }
    },
    [session?.sessionToken, notifications]
  );

  const loadVisitLedger = useCallback(
    async (customerId: string, visitId: string | null) => {
      if (!session?.sessionToken) return;
      const visitKey = `${customerId}:${visitId ?? 'unassigned'}`;
      try {
        const url = `${API_BASE}/v1/customers/${customerId}/visits/${visitId ?? 'unassigned'}/spend-ledger?limit=200`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${session.sessionToken}` },
        });
        if (!res.ok) {
          const payload: unknown = await res.json().catch(() => null);
          throw new Error(getErrorMessage(payload) || 'Failed to load visit ledger');
        }
        const data = (await res.json()) as SpendLedgerEntriesResponse;
        const entries = Array.isArray(data.entries) ? data.entries : [];
        setEntriesByVisitKey((p) => ({ ...p, [visitKey]: entries }));
      } catch (e) {
        notifications.warn(e instanceof Error ? e.message : 'Failed to load visit ledger');
      }
    },
    [session?.sessionToken, notifications]
  );

  const getGroups = useCallback(
    (customerId: string) => groupsByCustomerId[customerId] ?? [],
    [groupsByCustomerId]
  );

  const getVisitEntries = useCallback(
    (customerId: string, visitId: string | null) =>
      entriesByVisitKey[`${customerId}:${visitId ?? 'unassigned'}`] ?? [],
    [entriesByVisitKey]
  );

  const isLoading = useCallback(
    (customerId: string) => Boolean(loadingByCustomerId[customerId]),
    [loadingByCustomerId]
  );

  const getError = useCallback(
    (customerId: string) => errorByCustomerId[customerId] ?? null,
    [errorByCustomerId]
  );

  const hasLoaded = useCallback(
    (customerId: string) => Boolean(loadedByCustomerId[customerId]),
    [loadedByCustomerId]
  );

  return useMemo(
    () => ({
      loadSpendLedger,
      loadVisitLedger,
      getGroups,
      getVisitEntries,
      isLoading,
      hasLoaded,
      getError,
    }),
    [getError, getGroups, getVisitEntries, hasLoaded, isLoading, loadSpendLedger, loadVisitLedger]
  );
}
