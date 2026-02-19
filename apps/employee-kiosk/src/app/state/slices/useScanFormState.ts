import { useCallback, useMemo, useRef, useState } from 'react';
import type { CustomerIdType } from '@club-ops/shared';
import { getErrorMessage } from '@club-ops/shared';
import { parseDobDigitsToIso } from '../../../utils/dob';
import {
  extractAamvaIdentity,
  getAamvaActiveField,
  isLikelyAamvaPdf417Text,
  normalizeScanText,
  type AamvaActiveField,
} from '../../../scanner/aamvaParser';
import { API_BASE } from '../shared/api';
import type { ScanResult, StaffSession } from '../shared/types';

type ScanFormData = {
  rawScanText: string;
  firstName: string;
  lastName: string;
  fullName: string;
  dobDigits: string;
  idExpirationDigits: string;
  idType: CustomerIdType | '';
  idTypeOther: string;
  idNumber: string;
  issuer: string;
  jurisdiction: string;
};

type Params = {
  session: StaffSession | null;
  lane: string;
  startLaneSessionByCustomerId: (
    customerId: string,
    opts?: { suppressAlerts?: boolean; customerLabel?: string | null }
  ) => Promise<ScanResult>;
  setScanToastMessage: (message: string | null) => void;
  setScanProcessing: (value: boolean) => void;
  setIdScanIssue: (value: 'ID_EXPIRED' | 'UNDERAGE' | null) => void;
};

const defaultScanFormData: ScanFormData = {
  rawScanText: '',
  firstName: '',
  lastName: '',
  fullName: '',
  dobDigits: '',
  idExpirationDigits: '',
  idType: '',
  idTypeOther: '',
  idNumber: '',
  issuer: '',
  jurisdiction: '',
};

const isoToDigits = (iso?: string): string => {
  if (!iso) return '';
  const [year, month, day] = iso.split('-');
  if (!year || !month || !day) return '';
  return `${month}${day}${year}`.replace(/\D/g, '').slice(0, 8);
};

export function useScanFormState({
  session,
  lane,
  startLaneSessionByCustomerId,
  setScanToastMessage,
  setScanProcessing,
  setIdScanIssue,
}: Params) {
  const [scanFormData, setScanFormData] = useState<ScanFormData>(defaultScanFormData);
  const [scanFormActiveField, setScanFormActiveField] = useState<AamvaActiveField | null>(null);
  const [scanFormSubmitting, setScanFormSubmitting] = useState(false);
  const [scanFormError, setScanFormError] = useState<string | null>(null);
  const [scanFormEditing, setScanFormEditingState] = useState(false);
  const scanFormEditingRef = useRef(false);

  const scanFormDobIso = useMemo(
    () => parseDobDigitsToIso(scanFormData.dobDigits),
    [scanFormData.dobDigits]
  );
  const scanFormIdExpirationIso = useMemo(
    () => parseDobDigitsToIso(scanFormData.idExpirationDigits),
    [scanFormData.idExpirationDigits]
  );

  const setScanFormEditing = useCallback((value: boolean) => {
    scanFormEditingRef.current = value;
    setScanFormEditingState(value);
  }, []);

  const shouldKeepFocus = useCallback(() => !scanFormEditingRef.current, []);

  const resetScanForm = useCallback(() => {
    setScanFormData(defaultScanFormData);
    setScanFormActiveField(null);
    setScanFormError(null);
    setScanFormEditing(false);
  }, [setScanFormEditing]);

  const updateScanFormFromNormalized = useCallback((normalized: string) => {
    const extracted = extractAamvaIdentity(normalized);
    setScanFormData((prev) => ({
      ...prev,
      rawScanText: normalized,
      firstName: extracted.firstName ?? prev.firstName,
      lastName: extracted.lastName ?? prev.lastName,
      fullName: extracted.fullName ?? prev.fullName,
      dobDigits: extracted.dob ? isoToDigits(extracted.dob) : prev.dobDigits,
      idExpirationDigits: extracted.idExpirationDate
        ? isoToDigits(extracted.idExpirationDate)
        : prev.idExpirationDigits,
      idNumber: extracted.idNumber ?? prev.idNumber,
      issuer: extracted.issuer ?? prev.issuer,
      jurisdiction: extracted.jurisdiction ?? prev.jurisdiction,
      idType: extracted.idType ?? prev.idType,
      idTypeOther: extracted.idTypeOther ?? prev.idTypeOther,
    }));
    setScanFormActiveField(getAamvaActiveField(normalized));
  }, []);

  const handleAamvaInput = useCallback(
    (raw: string, options?: { finalize?: boolean }) => {
      const normalized = normalizeScanText(raw);
      if (!normalized || !isLikelyAamvaPdf417Text(normalized)) {
        return false;
      }
      updateScanFormFromNormalized(normalized);
      if (options?.finalize) {
        setScanFormActiveField(null);
        setScanFormError(null);
      }
      return true;
    },
    [updateScanFormFromNormalized]
  );

  const updateScanFormField = useCallback(function updateScanFormField<
    K extends keyof ScanFormData,
  >(field: K, value: ScanFormData[K]) {
    setScanFormData((prev) => {
      const next: ScanFormData = {
        ...prev,
        [field]: value,
      } as ScanFormData;
      if (field === 'idType' && value !== 'OTHER') {
        next.idTypeOther = '';
      }
      if ((field === 'firstName' || field === 'lastName') && prev.fullName) {
        next.fullName = '';
      }
      return next;
    });
    setScanFormError(null);
  }, []);

  const submitScanForm = useCallback(async () => {
    const firstName = scanFormData.firstName.trim();
    const lastName = scanFormData.lastName.trim();
    const fullName = scanFormData.fullName.trim();
    const idNumber = scanFormData.idNumber.trim();
    const dobIso = scanFormDobIso;
    const idExpirationDate = scanFormIdExpirationIso;
    const idType = scanFormData.idType;
    const idTypeOther = idType === 'OTHER' ? scanFormData.idTypeOther.trim() : '';

    if (!firstName || !lastName || !dobIso) {
      setScanFormError('Enter First Name, Last Name, and a valid Date of Birth (MM/DD/YYYY).');
      return;
    }
    if (!idExpirationDate) {
      setScanFormError('Enter a valid ID expiration date (MM/DD/YYYY).');
      return;
    }
    if (!idType) {
      setScanFormError('Select an ID type.');
      return;
    }
    if (idType === 'OTHER' && !idTypeOther) {
      setScanFormError('Specify the ID type.');
      return;
    }
    if (!session?.sessionToken) {
      setScanFormError('Not authenticated.');
      return;
    }

    setScanFormSubmitting(true);
    setScanProcessing(true);
    setScanFormError(null);
    setScanToastMessage(null);
    try {
      const response = await fetch(`${API_BASE}/v1/checkin/lane/${lane}/scan-id`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.sessionToken}`,
        },
        body: JSON.stringify({
          raw: scanFormData.rawScanText || undefined,
          firstName,
          lastName,
          fullName: !firstName || !lastName ? fullName || undefined : undefined,
          dob: dobIso || undefined,
          idExpirationDate: idExpirationDate || undefined,
          idNumber: idNumber || undefined,
          issuer: scanFormData.issuer || undefined,
          jurisdiction: scanFormData.jurisdiction || undefined,
          idType,
          idTypeOther: idType === 'OTHER' ? idTypeOther || undefined : undefined,
        }),
      });

      const payload: unknown = await response.json().catch(() => null);
      const issueCode = (() => {
        if (!payload || typeof payload !== 'object') return null;
        const code =
          typeof (payload as { code?: unknown }).code === 'string'
            ? (payload as { code?: string }).code
            : typeof (payload as { error?: { code?: unknown } }).error?.code === 'string'
              ? (payload as { error?: { code?: string } }).error?.code
              : undefined;
        if (code === 'ID_EXPIRED' || code === 'UNDERAGE') return code;
        return null;
      })();
      if (issueCode) {
        setIdScanIssue(issueCode);
        return;
      }

      if (!response.ok) {
        const msg = getErrorMessage(payload) || 'Failed to scan ID';
        setScanFormError(msg);
        return;
      }

      const data = payload as {
        customerId?: string;
        customerName?: string;
        alreadyCheckedIn?: boolean;
        code?: string;
      };
      if (data.alreadyCheckedIn || data.code === 'ALREADY_CHECKED_IN') {
        setScanToastMessage('Customer is already checked in.');
        return;
      }
      if (!data.customerId) {
        setScanFormError('Scan returned no customer id.');
        return;
      }

      const result = await startLaneSessionByCustomerId(data.customerId, {
        suppressAlerts: true,
        customerLabel: data.customerName ?? null,
      });
      if (result.outcome === 'matched') {
        resetScanForm();
      }
    } catch (error) {
      setScanFormError(error instanceof Error ? error.message : 'Failed to scan ID');
    } finally {
      setScanFormSubmitting(false);
      setScanProcessing(false);
    }
  }, [
    lane,
    resetScanForm,
    scanFormData,
    scanFormDobIso,
    scanFormIdExpirationIso,
    session?.sessionToken,
    setIdScanIssue,
    setScanProcessing,
    setScanToastMessage,
    startLaneSessionByCustomerId,
  ]);

  const scanFormCanSubmit =
    !!scanFormData.firstName.trim() &&
    !!scanFormData.lastName.trim() &&
    !!scanFormDobIso &&
    !!scanFormIdExpirationIso &&
    !!scanFormData.idType &&
    (scanFormData.idType !== 'OTHER' || !!scanFormData.idTypeOther.trim());

  return {
    scanFormData,
    scanFormActiveField,
    scanFormSubmitting,
    scanFormError,
    scanFormEditing,
    scanFormCanSubmit,
    setScanFormEditing,
    shouldKeepFocus,
    updateScanFormField,
    updateScanFormFromRaw: (raw: string) => void handleAamvaInput(raw),
    handleAamvaCapture: (raw: string) => handleAamvaInput(raw, { finalize: true }),
    resetScanForm,
    submitScanForm,
  };
}
