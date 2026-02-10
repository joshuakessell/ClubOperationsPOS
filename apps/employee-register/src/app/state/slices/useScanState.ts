import { useCallback } from 'react';
import { useScanCaptureInput } from '../../../scanner/useScanCaptureInput';
import { useScanResolutionState } from './useScanResolutionState';
import type { HomeTab, ScanResult, StaffSession } from '../shared/types';
import type { ToastNotifier } from '../shared/notifications';

type Params = {
  session: StaffSession | null;
  lane: string;
  homeTab: HomeTab;
  manualEntry: boolean;
  isSubmitting: boolean;
  externalBlocking: boolean;
  notifications: ToastNotifier;
  startLaneSessionByCustomerId: (
    customerId: string,
    opts?: { suppressAlerts?: boolean; customerLabel?: string | null }
  ) => Promise<ScanResult>;
};

export function useScanState({
  session,
  lane,
  homeTab,
  manualEntry,
  isSubmitting,
  externalBlocking,
  notifications,
  startLaneSessionByCustomerId,
}: Params) {
  const resolution = useScanResolutionState({ session, lane, startLaneSessionByCustomerId });

  const blockingModalOpen =
    externalBlocking ||
    !!resolution.pendingScanResolution ||
    resolution.showCreateFromScanPrompt ||
    !!resolution.idScanIssue;

  const scanEnabled =
    homeTab === 'scan' &&
    !!session?.sessionToken &&
    !isSubmitting &&
    !manualEntry &&
    !blockingModalOpen;

  const scanBlockedReason = !session?.sessionToken
    ? 'Not authenticated'
    : homeTab !== 'scan'
      ? 'Scan tab inactive'
      : isSubmitting
        ? 'Submitting'
        : manualEntry
          ? 'Manual entry active'
          : blockingModalOpen
            ? 'Modal open'
            : null;

  const computeIdleTimeout = useCallback((value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return 400;

    const hasInternalWhitespace = /\s/.test(trimmed);
    const looksLong = trimmed.length >= 24;

    if (hasInternalWhitespace || looksLong) {
      return 2400;
    }

    return 400;
  }, []);

  const submitScanText = useCallback(
    async (rawScanText: string) => {
      const result = await resolution.onBarcodeCaptured(rawScanText);

      if (result.outcome === 'error') {
        if (result.message) notifications.warn(result.message);
        return;
      }

      if (result.outcome === 'no_match') {
        notifications.info(result.message);
        if (result.canCreate) {
          resolution.setShowCreateFromScanPrompt(true);
        }
      }
    },
    [notifications, resolution]
  );

  const scanInput = useScanCaptureInput({
    enabled: scanEnabled,
    keepFocus: true,
    captureMode: 'document',
    idleTimeoutMs: 260,
    getIdleTimeoutMs: computeIdleTimeout,
    onCapture: (raw) => {
      void submitScanText(raw);
    },
  });

  return {
    scanReady: scanEnabled,
    scanBlockedReason,
    scanInputRef: scanInput.scanInputRef,
    scanInputHandlers: scanInput.scanInputHandlers,
    scanInputEnabled: scanEnabled,
    submitScanText,
    pendingScanResolution: resolution.pendingScanResolution,
    scanResolutionError: resolution.scanResolutionError,
    scanResolutionSubmitting: resolution.scanResolutionSubmitting,
    setPendingScanResolution: resolution.setPendingScanResolution,
    setScanResolutionError: resolution.setScanResolutionError,
    setScanResolutionSubmitting: resolution.setScanResolutionSubmitting,
    resolvePendingScanSelection: resolution.resolvePendingScanSelection,
    showCreateFromScanPrompt: resolution.showCreateFromScanPrompt,
    pendingCreateFromScan: resolution.pendingCreateFromScan,
    createFromScanError: resolution.createFromScanError,
    createFromScanSubmitting: resolution.createFromScanSubmitting,
    idScanIssue: resolution.idScanIssue,
    setIdScanIssue: resolution.setIdScanIssue,
    setShowCreateFromScanPrompt: resolution.setShowCreateFromScanPrompt,
    setPendingCreateFromScan: resolution.setPendingCreateFromScan,
    setCreateFromScanError: resolution.setCreateFromScanError,
    setCreateFromScanSubmitting: resolution.setCreateFromScanSubmitting,
    handleCreateFromNoMatch: resolution.handleCreateFromNoMatch,
    blockingModalOpen,
  };
}
