import { useCallback, useState } from 'react';
import type { CustomerIdType } from '@club-ops/shared';
import { getErrorMessage } from '@club-ops/ui';
import type { ScanResult, StaffSession } from '../shared/types';
import { API_BASE } from '../shared/api';
import { extractAamvaIdentity } from '../../../scanner/aamvaParser';

export type ScanReviewData = {
  rawScanText: string;
  firstName: string;
  lastName: string;
  dob: string;
  idExpirationDate: string;
  idNumber: string;
  issuer?: string;
  jurisdiction?: string;
  idType?: CustomerIdType;
  idTypeOther?: string;
};

export type ScanReviewField = 'firstName' | 'lastName' | 'dob' | 'idExpirationDate' | 'idNumber';

type Params = {
  session: StaffSession | null;
  lane: string;
  startLaneSessionByCustomerId: (
    customerId: string,
    opts?: { suppressAlerts?: boolean; customerLabel?: string | null }
  ) => Promise<ScanResult>;
  setIdScanIssue: (issue: 'ID_EXPIRED' | 'UNDERAGE' | null) => void;
};

export function useScanReviewState({
  session,
  lane,
  startLaneSessionByCustomerId,
  setIdScanIssue,
}: Params) {
  const [scanReviewData, setScanReviewData] = useState<ScanReviewData | null>(null);
  const [scanReviewError, setScanReviewError] = useState<string | null>(null);
  const [scanReviewSubmitting, setScanReviewSubmitting] = useState(false);

  const beginScanReview = useCallback((rawScanText: string) => {
    const extracted = extractAamvaIdentity(rawScanText);
    setScanReviewData({
      rawScanText,
      firstName: extracted.firstName ?? '',
      lastName: extracted.lastName ?? '',
      dob: extracted.dob ?? '',
      idExpirationDate: extracted.idExpirationDate ?? '',
      idNumber: extracted.idNumber ?? '',
      issuer: extracted.issuer,
      jurisdiction: extracted.jurisdiction,
      idType: extracted.idType,
      idTypeOther: extracted.idTypeOther,
    });
    setScanReviewError(null);
    setScanReviewSubmitting(false);
  }, []);

  const cancelScanReview = useCallback(() => {
    setScanReviewData(null);
    setScanReviewError(null);
    setScanReviewSubmitting(false);
  }, []);

  const updateScanReviewField = useCallback((field: ScanReviewField, value: string) => {
    setScanReviewData((prev) => {
      if (!prev) return prev;
      return { ...prev, [field]: value };
    });
  }, []);

  const submitScanReview = useCallback(async (): Promise<ScanResult> => {
    if (!scanReviewData) {
      return { outcome: 'error', message: 'No scan to submit.' };
    }
    if (!session?.sessionToken) {
      setScanReviewError('Not authenticated');
      return { outcome: 'error', message: 'Not authenticated' };
    }

    const firstName = scanReviewData.firstName.trim();
    const lastName = scanReviewData.lastName.trim();
    const dob = scanReviewData.dob.trim();
    const idExpirationDate = scanReviewData.idExpirationDate.trim();
    const idNumber = scanReviewData.idNumber.trim();

    if (!firstName || !lastName || !dob) {
      const msg = 'First name, last name, and date of birth are required.';
      setScanReviewError(msg);
      return { outcome: 'error', message: msg };
    }

    setScanReviewSubmitting(true);
    setScanReviewError(null);
    try {
      const response = await fetch(
        `${API_BASE}/v1/checkin/lane/${encodeURIComponent(lane)}/scan-id`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.sessionToken}`,
          },
          body: JSON.stringify({
            raw: scanReviewData.rawScanText,
            firstName,
            lastName,
            fullName: `${firstName} ${lastName}`.trim(),
            dob,
            idExpirationDate: idExpirationDate || undefined,
            idNumber: idNumber || undefined,
            issuer: scanReviewData.issuer,
            jurisdiction: scanReviewData.jurisdiction,
            idType: scanReviewData.idType,
            idTypeOther: scanReviewData.idTypeOther,
          }),
        }
      );

      const payload: unknown = await response.json().catch(() => null);

      if (response.ok) {
        if (
          payload &&
          typeof payload === 'object' &&
          'alreadyCheckedIn' in payload &&
          (payload as { alreadyCheckedIn?: boolean }).alreadyCheckedIn
        ) {
          const msg = 'Customer is already checked in.';
          setScanReviewError(msg);
          return { outcome: 'error', message: msg };
        }

        const customerId =
          payload && typeof payload === 'object'
            ? (payload as { customerId?: string }).customerId
            : undefined;
        const customerName =
          payload && typeof payload === 'object'
            ? (payload as { customerName?: string }).customerName
            : undefined;

        if (!customerId) {
          const msg = 'Scan did not return a customer id.';
          setScanReviewError(msg);
          return { outcome: 'error', message: msg };
        }

        cancelScanReview();
        await startLaneSessionByCustomerId(customerId, {
          suppressAlerts: true,
          customerLabel: customerName ?? `${firstName} ${lastName}`.trim(),
        });
        return { outcome: 'matched' };
      }

      const code = (() => {
        if (!payload || typeof payload !== 'object') return null;
        if ('code' in payload && typeof (payload as { code?: unknown }).code === 'string') {
          return (payload as { code: string }).code;
        }
        const error = (payload as { error?: unknown }).error;
        if (error && typeof error === 'object' && 'code' in error) {
          const errCode = (error as { code?: unknown }).code;
          return typeof errCode === 'string' ? errCode : null;
        }
        return null;
      })();

      if (code === 'ID_EXPIRED' || code === 'UNDERAGE') {
        setIdScanIssue(code);
        cancelScanReview();
        return { outcome: 'error', message: '' };
      }

      const msg = getErrorMessage(payload) || 'Failed to scan ID';
      setScanReviewError(msg);
      return { outcome: 'error', message: msg };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to scan ID';
      setScanReviewError(msg);
      return { outcome: 'error', message: msg };
    } finally {
      setScanReviewSubmitting(false);
    }
  }, [
    cancelScanReview,
    lane,
    scanReviewData,
    session?.sessionToken,
    setIdScanIssue,
    startLaneSessionByCustomerId,
  ]);

  return {
    scanReviewData,
    scanReviewOpen: !!scanReviewData,
    scanReviewError,
    scanReviewSubmitting,
    beginScanReview,
    cancelScanReview,
    updateScanReviewField,
    submitScanReview,
  };
}
