import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser';
import {
  BarcodeFormat,
  ChecksumException,
  DecodeHintType,
  FormatException,
  NotFoundException,
} from '@zxing/library';

type CameraScanStatus = 'idle' | 'starting' | 'active' | 'error';

type CameraScanOptions = {
  enabled: boolean;
  onScan: (value: string) => void;
  facingMode?: 'user' | 'environment';
  scanCooldownMs?: number;
};

type CameraScanState = {
  status: CameraScanStatus;
  error: string | null;
};

const DEFAULT_SCAN_COOLDOWN_MS = 1400;
const DEFAULT_SCAN_INTERVAL_MS = 180;

export function useCameraBarcodeScanner({
  enabled,
  onScan,
  facingMode = 'user',
  scanCooldownMs = DEFAULT_SCAN_COOLDOWN_MS,
}: CameraScanOptions) {
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  const [state, setState] = useState<CameraScanState>({ status: 'idle', error: null });
  const controlsRef = useRef<IScannerControls | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const lastScanValueRef = useRef<string | null>(null);
  const lastScanAtRef = useRef<number>(0);

  const setVideoRef = useCallback((node: HTMLVideoElement | null) => {
    setVideoElement(node);
  }, []);

  const hints = useMemo(() => {
    const formats = [
      BarcodeFormat.PDF_417,
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.ITF,
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.QR_CODE,
    ];

    return new Map<DecodeHintType, unknown>([
      [DecodeHintType.POSSIBLE_FORMATS, formats],
      [DecodeHintType.TRY_HARDER, true],
    ]);
  }, []);

  const stop = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    readerRef.current = null;
    setState((prev) => (prev.status === 'idle' ? prev : { status: 'idle', error: null }));
  }, []);

  useEffect(() => {
    if (!enabled) {
      stop();
      return;
    }

    if (!videoElement) return;

    if (!navigator.mediaDevices?.getUserMedia) {
      setState({
        status: 'error',
        error: 'Camera unavailable on this device.',
      });
      return;
    }

    let cancelled = false;
    setState({ status: 'starting', error: null });

    const reader = new BrowserMultiFormatReader(hints, {
      delayBetweenScanAttempts: DEFAULT_SCAN_INTERVAL_MS,
    });
    readerRef.current = reader;

    const constraints: MediaStreamConstraints = {
      audio: false,
      video: {
        facingMode: { ideal: facingMode },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    };

    void reader
      .decodeFromConstraints(constraints, videoElement, (result, error) => {
        if (cancelled) return;
        if (result) {
          const text = result.getText();
          if (!text) return;
          const now = Date.now();
          const lastText = lastScanValueRef.current;
          if (lastText === text && now - lastScanAtRef.current < scanCooldownMs) {
            return;
          }
          lastScanValueRef.current = text;
          lastScanAtRef.current = now;
          onScan(text);
          return;
        }
        if (
          error &&
          !(error instanceof NotFoundException) &&
          !(error instanceof FormatException) &&
          !(error instanceof ChecksumException)
        ) {
          console.warn('Camera scan error:', error);
        }
      })
      .then((controls) => {
        if (cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
        setState({ status: 'active', error: null });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Unable to access camera.';
        setState({ status: 'error', error: message });
      });

    return () => {
      cancelled = true;
      stop();
    };
  }, [enabled, facingMode, hints, onScan, scanCooldownMs, stop, videoElement]);

  return {
    videoRef: setVideoRef,
    status: state.status,
    error: state.error,
    active: state.status === 'active' || state.status === 'starting',
  };
}

export type { CameraScanStatus };
