import { useMemo, useState } from 'react';
import type { CustomerIdType } from '@club-ops/shared';
import { getErrorMessage } from '@club-ops/ui';
import { parseDobDigitsToIso } from '../../../utils/dob';
import { API_BASE } from '../shared/api';
import type { ScanResult, StaffSession } from '../shared/types';
import type { ToastNotifier } from '../shared/notifications';

type ManualExistingPrompt = {
  firstName: string;
  lastName: string;
  dobIso: string;
  idExpirationDate: string;
  idType: CustomerIdType;
  idTypeOther?: string | null;
  idNumber?: string | null;
  matchCount: number;
  bestMatch: { id: string; name: string; membershipNumber?: string | null; dob?: string | null };
};

type Params = {
  session: StaffSession | null;
  manualEntry: boolean;
  setManualEntry: (value: boolean) => void;
  startLaneSessionByCustomerId: (
    customerId: string,
    opts?: { suppressAlerts?: boolean; customerLabel?: string | null }
  ) => Promise<ScanResult>;
  notifications: ToastNotifier;
};

export function useManualEntryState({
  session,
  manualEntry,
  setManualEntry,
  startLaneSessionByCustomerId,
  notifications,
}: Params) {
  const [manualFirstName, setManualFirstName] = useState('');
  const [manualLastName, setManualLastName] = useState('');
  const [manualDobDigits, setManualDobDigits] = useState('');
  const manualDobIso = useMemo(() => parseDobDigitsToIso(manualDobDigits), [manualDobDigits]);
  const [manualIdExpirationDigits, setManualIdExpirationDigits] = useState('');
  const manualIdExpirationIso = useMemo(
    () => parseDobDigitsToIso(manualIdExpirationDigits),
    [manualIdExpirationDigits]
  );
  const [manualIdType, setManualIdType] = useState<CustomerIdType | ''>('');
  const [manualIdTypeOther, setManualIdTypeOther] = useState('');
  const [manualIdNumber, setManualIdNumber] = useState('');
  const [manualEntrySubmitting, setManualEntrySubmitting] = useState(false);
  const [manualExistingPrompt, setManualExistingPrompt] = useState<ManualExistingPrompt | null>(
    null
  );
  const [manualExistingPromptError, setManualExistingPromptError] = useState<string | null>(null);
  const [manualExistingPromptSubmitting, setManualExistingPromptSubmitting] = useState(false);

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const firstName = manualFirstName.trim();
    const lastName = manualLastName.trim();
    const dobIso = manualDobIso;
    const idExpirationDate = manualIdExpirationIso;
    const idType = manualIdType;
    const idTypeOther = manualIdType === 'OTHER' ? manualIdTypeOther.trim() : '';
    const idNumber = manualIdNumber.trim();
    if (!firstName || !lastName || !dobIso) {
      notifications.warn(
        'Please enter First Name, Last Name, and a valid Date of Birth (MM/DD/YYYY).'
      );
      return;
    }
    if (!idExpirationDate) {
      notifications.warn('Please enter a valid ID expiration date (MM/DD/YYYY).');
      return;
    }
    if (!idType) {
      notifications.warn('Please select an ID type.');
      return;
    }
    if (idType === 'OTHER' && !idTypeOther) {
      notifications.warn('Please specify the ID type.');
      return;
    }
    if (!session?.sessionToken) {
      notifications.warn('Not authenticated');
      return;
    }

    setManualEntrySubmitting(true);
    setManualExistingPromptError(null);
    try {
      const matchRes = await fetch(`${API_BASE}/v1/customers/match-identity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.sessionToken}`,
        },
        body: JSON.stringify({ firstName, lastName, dob: dobIso }),
      });

      const matchPayload: unknown = await matchRes.json().catch(() => null);
      if (!matchRes.ok) {
        const msg = getErrorMessage(matchPayload) || 'Failed to check for existing customer';
        setManualExistingPromptError(msg);
        return;
      }

      const data = matchPayload as {
        matchCount?: number;
        bestMatch?: {
          id?: string;
          name?: string;
          membershipNumber?: string | null;
          dob?: string | null;
        } | null;
      };
      const best = data.bestMatch;
      const matchCount = typeof data.matchCount === 'number' ? data.matchCount : 0;
      if (best && typeof best.id === 'string' && typeof best.name === 'string') {
        setManualExistingPrompt({
          firstName,
          lastName,
          dobIso,
          idExpirationDate,
          idType,
          idTypeOther: idType === 'OTHER' ? idTypeOther : null,
          idNumber: idNumber || null,
          matchCount,
          bestMatch: {
            id: best.id,
            name: best.name,
            membershipNumber: best.membershipNumber,
            dob: best.dob,
          },
        });
        return;
      }

      const createRes = await fetch(`${API_BASE}/v1/customers/create-manual`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.sessionToken}`,
        },
        body: JSON.stringify({
          firstName,
          lastName,
          dob: dobIso,
          idExpirationDate,
          idType,
          idTypeOther: idType === 'OTHER' ? idTypeOther : undefined,
          idNumber: idNumber || undefined,
        }),
      });
      const createPayload: unknown = await createRes.json().catch(() => null);
      if (!createRes.ok) {
        const msg = getErrorMessage(createPayload) || 'Failed to create customer';
        setManualExistingPromptError(msg);
        return;
      }
      const created = createPayload as { customer?: { id?: string } };
      const newId = created.customer?.id;
      if (!newId) {
        setManualExistingPromptError('Create returned no customer id');
        return;
      }

      const result = await startLaneSessionByCustomerId(newId, { suppressAlerts: true });
      if (result.outcome === 'matched') {
        setManualEntry(false);
        setManualFirstName('');
        setManualLastName('');
        setManualDobDigits('');
        setManualIdExpirationDigits('');
        setManualIdType('');
        setManualIdTypeOther('');
        setManualIdNumber('');
      }
    } finally {
      setManualEntrySubmitting(false);
    }
  };

  return {
    manualEntry,
    setManualEntry,
    manualFirstName,
    setManualFirstName,
    manualLastName,
    setManualLastName,
    manualDobDigits,
    setManualDobDigits,
    manualDobIso,
    manualIdExpirationDigits,
    setManualIdExpirationDigits,
    manualIdExpirationIso,
    manualIdType,
    setManualIdType,
    manualIdTypeOther,
    setManualIdTypeOther,
    manualIdNumber,
    setManualIdNumber,
    manualEntrySubmitting,
    manualExistingPrompt,
    manualExistingPromptError,
    manualExistingPromptSubmitting,
    setManualExistingPrompt,
    setManualExistingPromptError,
    setManualExistingPromptSubmitting,
    handleManualSubmit,
  };
}
