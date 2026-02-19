import { useCallback, useMemo, useState } from 'react';
import { API_BASE } from '../shared/api';
import type { StaffSession } from '../shared/types';
import type { ToastNotifier } from '../shared/notifications';
import { getErrorMessage } from '@club-ops/shared';

export type CustomerDocument = {
  id: string;
  doc_type: 'AGREEMENT_PDF';
  mime_type: 'application/pdf';
  created_at: string;
  visit_started_at: string | null;
  visit_ended_at: string | null;
  has_pdf: boolean;
  has_signature: boolean;
};

type CustomerDocumentsResponse = {
  documents: CustomerDocument[];
};

type Params = {
  session: StaffSession | null;
  notifications: ToastNotifier;
};

export function useCustomerDocumentsState({ session, notifications }: Params) {
  const [docsByCustomerId, setDocsByCustomerId] = useState<Record<string, CustomerDocument[]>>({});
  const [loadingByCustomerId, setLoadingByCustomerId] = useState<Record<string, boolean>>({});
  const [errorByCustomerId, setErrorByCustomerId] = useState<Record<string, string | null>>({});

  const loadDocuments = useCallback(
    async (customerId: string) => {
      if (!session?.sessionToken) return;
      setLoadingByCustomerId((p) => ({ ...p, [customerId]: true }));
      setErrorByCustomerId((p) => ({ ...p, [customerId]: null }));
      try {
        const res = await fetch(`${API_BASE}/v1/documents/by-customer/${customerId}`, {
          headers: { Authorization: `Bearer ${session.sessionToken}` },
        });
        if (!res.ok) {
          const payload: unknown = await res.json().catch(() => null);
          throw new Error(getErrorMessage(payload) || 'Failed to load documents');
        }
        const data = (await res.json()) as CustomerDocumentsResponse;
        const docs = Array.isArray(data.documents) ? data.documents : [];
        setDocsByCustomerId((p) => ({ ...p, [customerId]: docs }));
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to load documents';
        setErrorByCustomerId((p) => ({ ...p, [customerId]: msg }));
        notifications.warn(msg);
      } finally {
        setLoadingByCustomerId((p) => ({ ...p, [customerId]: false }));
      }
    },
    [notifications, session?.sessionToken]
  );

  const getDocuments = useCallback(
    (customerId: string) => docsByCustomerId[customerId] ?? [],
    [docsByCustomerId]
  );

  const isLoading = useCallback(
    (customerId: string) => Boolean(loadingByCustomerId[customerId]),
    [loadingByCustomerId]
  );

  const getError = useCallback(
    (customerId: string) => errorByCustomerId[customerId] ?? null,
    [errorByCustomerId]
  );

  return useMemo(
    () => ({ loadDocuments, getDocuments, isLoading, getError }),
    [getDocuments, getError, isLoading, loadDocuments]
  );
}
