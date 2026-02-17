import { useCallback, useMemo, useState } from 'react';
import { getErrorMessage } from '@club-ops/ui';
import { API_BASE } from '../shared/api';
import type { StaffSession } from '../shared/types';
import type { ToastNotifier } from '../shared/notifications';

export type CustomerNote = {
  id: string;
  createdAt: string;
  createdByStaffId: string | null;
  createdByStaffName: string;
  sourceApp: string;
  note: string;
  isImportant: boolean;
};

type CustomerNotesResponse = {
  notes: CustomerNote[];
  nextCursor: string | null;
};

type Params = {
  session: StaffSession | null;
  notifications: ToastNotifier;
};

export function useCustomerNotesState({ session, notifications }: Params) {
  const [notesByCustomerId, setNotesByCustomerId] = useState<Record<string, CustomerNote[]>>({});
  const [loadingByCustomerId, setLoadingByCustomerId] = useState<Record<string, boolean>>({});
  const [errorByCustomerId, setErrorByCustomerId] = useState<Record<string, string | null>>({});
  const [loadedByCustomerId, setLoadedByCustomerId] = useState<Record<string, boolean>>({});

  const loadNotes = useCallback(
    async (customerId: string) => {
      if (!session?.sessionToken) return;
      setLoadingByCustomerId((p) => ({ ...p, [customerId]: true }));
      setErrorByCustomerId((p) => ({ ...p, [customerId]: null }));
      try {
        const res = await fetch(`${API_BASE}/v1/customers/${customerId}/notes?limit=50`, {
          headers: {
            Authorization: `Bearer ${session.sessionToken}`,
          },
        });

        if (!res.ok) {
          const payload: unknown = await res.json().catch(() => null);
          throw new Error(getErrorMessage(payload) || 'Failed to load notes');
        }

        const data = (await res.json()) as CustomerNotesResponse;
        const notes = Array.isArray(data.notes) ? data.notes : [];

        setNotesByCustomerId((p) => ({ ...p, [customerId]: notes }));
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to load notes';
        setErrorByCustomerId((p) => ({ ...p, [customerId]: msg }));
      } finally {
        setLoadingByCustomerId((p) => ({ ...p, [customerId]: false }));
        setLoadedByCustomerId((p) => ({ ...p, [customerId]: true }));
      }
    },
    [session?.sessionToken]
  );

  const createNote = useCallback(
    async (
      customerId: string,
      note: { note: string; isImportant?: boolean; sourceApp?: string }
    ) => {
      if (!session?.sessionToken) return;
      const trimmed = note.note.trim();
      if (!trimmed) return;

      try {
        const res = await fetch(`${API_BASE}/v1/customers/${customerId}/notes`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.sessionToken}`,
          },
          body: JSON.stringify({
            note: trimmed,
            isImportant: note.isImportant ?? false,
            sourceApp: note.sourceApp ?? 'EMPLOYEE_REGISTER',
          }),
        });

        if (!res.ok) {
          const payload: unknown = await res.json().catch(() => null);
          throw new Error(getErrorMessage(payload) || 'Failed to create note');
        }

        await loadNotes(customerId);
      } catch (e) {
        notifications.warn(e instanceof Error ? e.message : 'Failed to create note');
      }
    },
    [session?.sessionToken, loadNotes, notifications]
  );

  const getNotes = useCallback(
    (customerId: string) => notesByCustomerId[customerId] ?? [],
    [notesByCustomerId]
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
      loadNotes,
      createNote,
      getNotes,
      isLoading,
      hasLoaded,
      getError,
    }),
    [createNote, getError, getNotes, hasLoaded, isLoading, loadNotes]
  );
}
