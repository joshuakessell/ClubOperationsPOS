import { useCallback, useState } from 'react';
import { customersCreateManual, customersMatchIdentity } from '../../../api/employeeRegisterApi';
import { parseDobDigitsToIso } from '../../../utils/dob';

export type ManualExistingPrompt = {
  firstName: string;
  lastName: string;
  dobIso: string;
  matchCount: number;
  bestMatch: { id: string; name: string; membershipNumber?: string | null; dob?: string | null };
};

type StartLaneResult = { outcome: 'matched' | 'no_match' | 'error' };

export function useManualEntryController(opts: {
  sessionToken: string | null;
  showAlert: (message: string, title?: string) => void;
  startLaneSessionByCustomerId: (customerId: string, opts?: { suppressAlerts?: boolean }) => Promise<StartLaneResult>;
}) {
  const { sessionToken, showAlert, startLaneSessionByCustomerId } = opts;

  const [manualEntry, setManualEntry] = useState(false);
  const [manualFirstName, setManualFirstName] = useState('');
  const [manualLastName, setManualLastName] = useState('');
  const [manualDobDigits, setManualDobDigits] = useState('');
  const [manualEntrySubmitting, setManualEntrySubmitting] = useState(false);

  const [manualExistingPrompt, setManualExistingPrompt] = useState<ManualExistingPrompt | null>(null);
  const [manualExistingPromptError, setManualExistingPromptError] = useState<string | null>(null);
  const [manualExistingPromptSubmitting, setManualExistingPromptSubmitting] = useState(false);

  const resetForm = useCallback(() => {
    setManualEntry(false);
    setManualFirstName('');
    setManualLastName('');
    setManualDobDigits('');
  }, []);

  const closeExistingPrompt = useCallback(() => {
    setManualExistingPrompt(null);
    setManualExistingPromptError(null);
    setManualExistingPromptSubmitting(false);
  }, []);

  const onManualSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const firstName = manualFirstName.trim();
      const lastName = manualLastName.trim();
      const dobIso = parseDobDigitsToIso(manualDobDigits);
      if (!firstName || !lastName || !dobIso) {
        showAlert(
          'Please enter First Name, Last Name, and a valid Date of Birth (MM/DD/YYYY).',
          'Validation'
        );
        return;
      }
      if (!sessionToken) {
        showAlert('Not authenticated', 'Error');
        return;
      }

      setManualEntrySubmitting(true);
      setManualExistingPromptError(null);
      try {
        // First: check for existing customer match (name + dob).
        let data: {
          matchCount?: number;
          bestMatch?: { id?: string; name?: string; membershipNumber?: string | null; dob?: string | null } | null;
        };
        try {
          data = await customersMatchIdentity({
            sessionToken,
            firstName,
            lastName,
            dob: dobIso,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Failed to check for existing customer';
          setManualExistingPromptError(msg);
          return;
        }

        const best = data.bestMatch;
        const matchCount = typeof data.matchCount === 'number' ? data.matchCount : 0;
        if (best && typeof best.id === 'string' && typeof best.name === 'string') {
          // Show confirmation prompt instead of creating a duplicate immediately.
          setManualExistingPrompt({
            firstName,
            lastName,
            dobIso,
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

        // No match: create new customer then load it.
        let created: { customer?: { id?: string } };
        try {
          created = await customersCreateManual({
            sessionToken,
            firstName,
            lastName,
            dob: dobIso,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Failed to create customer';
          setManualExistingPromptError(msg);
          return;
        }
        const newId = created.customer?.id;
        if (!newId) {
          setManualExistingPromptError('Create returned no customer id');
          return;
        }

        const result = await startLaneSessionByCustomerId(newId, { suppressAlerts: true });
        if (result.outcome === 'matched') resetForm();
      } finally {
        setManualEntrySubmitting(false);
      }
    },
    [
      manualDobDigits,
      manualFirstName,
      manualLastName,
      resetForm,
      sessionToken,
      showAlert,
      startLaneSessionByCustomerId,
    ]
  );

  const chooseExistingCustomer = useCallback(async () => {
    if (!manualExistingPrompt) return;
    setManualExistingPromptSubmitting(true);
    setManualExistingPromptError(null);
    try {
      const result = await startLaneSessionByCustomerId(manualExistingPrompt.bestMatch.id, {
        suppressAlerts: true,
      });
      if (result.outcome === 'matched') {
        closeExistingPrompt();
        resetForm();
      }
    } catch (err) {
      setManualExistingPromptError(
        err instanceof Error ? err.message : 'Failed to load existing customer'
      );
    } finally {
      setManualExistingPromptSubmitting(false);
    }
  }, [closeExistingPrompt, manualExistingPrompt, resetForm, startLaneSessionByCustomerId]);

  const createNewCustomer = useCallback(async () => {
    if (!manualExistingPrompt || !sessionToken) return;
    setManualExistingPromptSubmitting(true);
    setManualExistingPromptError(null);
    try {
      const { firstName, lastName, dobIso } = manualExistingPrompt;
      let created: { customer?: { id?: string } };
      try {
        created = await customersCreateManual({
          sessionToken,
          firstName,
          lastName,
          dob: dobIso,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to create customer';
        setManualExistingPromptError(msg);
        return;
      }
      const newId = created.customer?.id;
      if (!newId) {
        setManualExistingPromptError('Create returned no customer id');
        return;
      }
      const result = await startLaneSessionByCustomerId(newId, { suppressAlerts: true });
      if (result.outcome === 'matched') {
        closeExistingPrompt();
        resetForm();
      }
    } finally {
      setManualExistingPromptSubmitting(false);
    }
  }, [closeExistingPrompt, manualExistingPrompt, resetForm, sessionToken, startLaneSessionByCustomerId]);

  return {
    // Manual entry form
    manualEntry,
    setManualEntry,
    manualFirstName,
    setManualFirstName,
    manualLastName,
    setManualLastName,
    manualDobDigits,
    setManualDobDigits,
    manualEntrySubmitting,
    onManualSubmit,
    resetForm,

    // Existing customer prompt
    manualExistingPrompt,
    manualExistingPromptError,
    manualExistingPromptSubmitting,
    closeExistingPrompt,
    chooseExistingCustomer,
    createNewCustomer,
  };
}

