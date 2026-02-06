import { useCallback, useEffect, useRef, useState } from 'react';
import { useScanCaptureInput } from '../../../scanner/useScanCaptureInput';
import { useCameraBarcodeScanner } from '../../../scanner/useCameraBarcodeScanner';
import { isLikelyAamvaPdf417Text } from '../../../scanner/aamvaParser';
import { useScanResolutionState } from './useScanResolutionState';
import { useScanReviewState } from './useScanReviewState';
import type { HomeTab, ScanResult, StaffSession } from '../shared/types';

type Params = {
  session: StaffSession | null;
  lane: string;
  homeTab: HomeTab;
  manualEntry: boolean;
  isSubmitting: boolean;
  externalBlocking: boolean;
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
  startLaneSessionByCustomerId,
}: Params) {
  const resolution = useScanResolutionState({ session, lane, startLaneSessionByCustomerId });
  const review = useScanReviewState({
    session,
    lane,
    startLaneSessionByCustomerId,
    setIdScanIssue: resolution.setIdScanIssue,
  });

  const blockingModalOpen =
    externalBlocking ||
    !!resolution.pendingScanResolution ||
    resolution.showCreateFromScanPrompt ||
    !!resolution.idScanIssue ||
    review.scanReviewOpen;

  const [scanOverlayMounted, setScanOverlayMounted] = useState(false);
  const [scanOverlayActive, setScanOverlayActive] = useState(false);
  const [scanToastMessage, setScanToastMessage] = useState<string | null>(null);
  const [scanProcessing, setScanProcessing] = useState(false);
  const [cameraRequested, setCameraRequested] = useState(false);
  const scanProcessingRef = useRef(false);
  const scanOverlayHideTimerRef = useRef<number | null>(null);
  const scanOverlayShownAtRef = useRef<number | null>(null);
  const SCAN_OVERLAY_MIN_VISIBLE_MS = 250;

  const scanEnabled =
    homeTab === 'scan' &&
    !!session?.sessionToken &&
    !isSubmitting &&
    !manualEntry &&
    !blockingModalOpen &&
    !scanProcessing;

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
            : scanProcessing
              ? 'Processing scan'
              : null;

  const showScanOverlay = useCallback(() => {
    if (scanOverlayHideTimerRef.current) {
      window.clearTimeout(scanOverlayHideTimerRef.current);
      scanOverlayHideTimerRef.current = null;
    }

    if (!scanOverlayMounted) {
      setScanOverlayMounted(true);
    }

    window.requestAnimationFrame(() => {
      setScanOverlayActive(true);
      scanOverlayShownAtRef.current = Date.now();
    });
  }, [scanOverlayMounted]);

  const hideScanOverlay = useCallback(() => {
    if (scanOverlayHideTimerRef.current) return;
    const now = Date.now();
    const shownAt = scanOverlayShownAtRef.current ?? now;
    const elapsed = now - shownAt;
    const remaining = Math.max(0, SCAN_OVERLAY_MIN_VISIBLE_MS - elapsed);
    scanOverlayHideTimerRef.current = window.setTimeout(() => {
      setScanOverlayActive(false);
      window.setTimeout(() => {
        setScanOverlayMounted(false);
        scanOverlayHideTimerRef.current = null;
        scanOverlayShownAtRef.current = null;
      }, 220);
    }, remaining);
  }, []);

  const normalizeScanText = useCallback((raw: string) => {
    if (!raw) return '';
    const cleaned = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    return cleaned
      .split('\n')
      .filter((line) => line.trim().toUpperCase() !== 'ZTZTAN')
      .join('\n')
      .trim();
  }, []);

  const computeIdleTimeout = useCallback((value: string) => {
    const cleaned = value.replace(/\r/g, '\n');
    const trimmed = cleaned.trim();
    if (!trimmed) return 400;

    const looksAamva =
      trimmed.startsWith('@') ||
      trimmed.includes('ANSI ') ||
      trimmed.includes('AAMVA') ||
      /\nDCS/.test(cleaned) ||
      /\nDAQ/.test(cleaned);
    const hasInternalWhitespace = /\s/.test(trimmed);
    const looksLong = trimmed.length >= 24;

    if (looksAamva || hasInternalWhitespace || looksLong) {
      return 2400;
    }

    return 400;
  }, []);

  const handleCapture = useCallback(
    async (raw: string, options?: { showProcessingOverlay?: boolean }) => {
      if (scanProcessingRef.current) return;
      const normalized = normalizeScanText(raw);
      if (!normalized) {
        return;
      }
      setScanToastMessage(null);
      if (isLikelyAamvaPdf417Text(normalized)) {
        review.beginScanReview(normalized);
        return;
      }
      if (options?.showProcessingOverlay) {
        showScanOverlay();
      }
      setScanProcessing(true);
      try {
        const result = await resolution.onBarcodeCaptured(normalized);
        if (result.outcome === 'no_match') {
          if (result.canCreate) {
            resolution.setCreateFromScanError(null);
            resolution.setShowCreateFromScanPrompt(true);
          } else {
            setScanToastMessage(result.message);
          }
          return;
        }
        if (result.outcome === 'error') {
          if (result.message) setScanToastMessage(result.message);
        }
      } finally {
        setScanProcessing(false);
        if (options?.showProcessingOverlay) {
          hideScanOverlay();
        }
      }
    },
    [hideScanOverlay, normalizeScanText, resolution, review, showScanOverlay]
  );

  useEffect(() => {
    scanProcessingRef.current = scanProcessing;
  }, [scanProcessing]);

  const handleCameraScan = useCallback(
    (raw: string) => {
      if (scanProcessingRef.current) return;
      setCameraRequested(false);
      void handleCapture(raw, { showProcessingOverlay: true });
    },
    [handleCapture]
  );

  const cameraEnabled = scanEnabled && cameraRequested;

  const cameraScan = useCameraBarcodeScanner({
    enabled: cameraEnabled,
    facingMode: 'user',
    onScan: handleCameraScan,
  });

  const scanInputEnabled = scanEnabled && !cameraRequested;

  const scanInput = useScanCaptureInput({
    enabled: scanInputEnabled,
    keepFocus: true,
    idleTimeoutMs: 260,
    getIdleTimeoutMs: computeIdleTimeout,
    onCaptureStart: () => {
      showScanOverlay();
    },
    onCaptureEnd: () => {
      hideScanOverlay();
    },
    onCancel: () => {
      hideScanOverlay();
    },
    onCapture: (raw) => {
      void handleCapture(raw);
    },
  });

  const cameraOverlayVisible = cameraRequested && scanEnabled;

  const startCameraScan = useCallback(() => {
    if (!scanEnabled || cameraRequested) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setScanToastMessage('Camera unavailable on this device.');
      return;
    }
    void (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: 'user' } },
        });
        stream.getTracks().forEach((track) => track.stop());
        setCameraRequested(true);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Camera permission denied. Enable camera access in iPad Settings.';
        setScanToastMessage(message);
        setCameraRequested(false);
      }
    })();
  }, [cameraRequested, scanEnabled, setScanToastMessage]);

  const stopCameraScan = useCallback(() => {
    setCameraRequested(false);
  }, []);

  useEffect(() => {
    if (cameraRequested && !scanEnabled) {
      setCameraRequested(false);
    }
  }, [cameraRequested, scanEnabled]);

  useEffect(() => {
    return () => {
      if (scanOverlayHideTimerRef.current) {
        window.clearTimeout(scanOverlayHideTimerRef.current);
      }
    };
  }, []);

  return {
    scanOverlayMounted,
    scanOverlayActive,
    scanToastMessage,
    setScanToastMessage,
    scanReady: scanEnabled,
    scanBlockedReason,
    cameraOverlayVisible,
    cameraStatus: cameraScan.status,
    cameraError: cameraScan.error,
    cameraActive: cameraScan.active,
    cameraVideoRef: cameraScan.videoRef,
    scanInputRef: scanInput.scanInputRef,
    scanInputHandlers: scanInput.scanInputHandlers,
    scanInputEnabled,
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
    scanReviewData: review.scanReviewData,
    scanReviewOpen: review.scanReviewOpen,
    scanReviewError: review.scanReviewError,
    scanReviewSubmitting: review.scanReviewSubmitting,
    beginScanReview: review.beginScanReview,
    cancelScanReview: review.cancelScanReview,
    updateScanReviewField: review.updateScanReviewField,
    submitScanReview: review.submitScanReview,
    blockingModalOpen,
    startCameraScan,
    stopCameraScan,
    cameraRequested,
  };
}
