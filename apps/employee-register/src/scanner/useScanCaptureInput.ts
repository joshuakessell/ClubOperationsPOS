import { useCallback, useEffect, useRef } from 'react';
import type { FormEventHandler, KeyboardEvent } from 'react';

type ScanCaptureOptions = {
  enabled: boolean;
  onCapture: (raw: string) => void;
  onCaptureStart?: () => void;
  onCaptureEnd?: () => void;
  onCancel?: () => void;
  onBufferUpdate?: (value: string) => void;
  idleTimeoutMs?: number;
  getIdleTimeoutMs?: (value: string) => number;
  keepFocus?: boolean;
  shouldKeepFocus?: () => boolean;
  captureMode?: 'input' | 'document';
  humanGapMs?: number;
};

type ScanCaptureHandlers = {
  onBlur: () => void;
  onInput: FormEventHandler<HTMLTextAreaElement>;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
};

export function useScanCaptureInput({
  enabled,
  onCapture,
  onCaptureStart,
  onCaptureEnd,
  onCancel,
  onBufferUpdate,
  idleTimeoutMs = 220,
  getIdleTimeoutMs,
  keepFocus = true,
  shouldKeepFocus,
  captureMode = 'input',
  humanGapMs = 80,
}: ScanCaptureOptions) {
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const capturingRef = useRef(false);
  const refocusQueuedRef = useRef(false);
  const bufferRef = useRef('');
  const lastKeyTimeRef = useRef(0);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const resetValue = useCallback(() => {
    const el = inputRef.current;
    if (el) el.value = '';
    bufferRef.current = '';
  }, []);

  const stopCapture = useCallback(() => {
    if (capturingRef.current) {
      capturingRef.current = false;
      onCaptureEnd?.();
    }
    clearTimer();
  }, [clearTimer, onCaptureEnd]);

  const focusInput = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    try {
      el.focus({ preventScroll: true });
    } catch {
      el.focus();
    }
  }, []);

  const queueRefocus = useCallback(() => {
    if (refocusQueuedRef.current) return;
    refocusQueuedRef.current = true;
    window.requestAnimationFrame(() => {
      refocusQueuedRef.current = false;
      focusInput();
    });
  }, [focusInput]);

  const getCurrentValue = useCallback(
    () => (captureMode === 'document' ? bufferRef.current : inputRef.current?.value ?? ''),
    [captureMode]
  );

  const finalize = useCallback(() => {
    const raw = getCurrentValue();
    stopCapture();
    resetValue();
    if (!raw.trim()) return;
    onCapture(raw);
  }, [getCurrentValue, onCapture, resetValue, stopCapture]);

  const scheduleFinalize = useCallback(() => {
    clearTimer();
    const value = getCurrentValue();
    const timeout = getIdleTimeoutMs ? getIdleTimeoutMs(value) : idleTimeoutMs;
    timerRef.current = window.setTimeout(() => {
      finalize();
    }, timeout);
  }, [clearTimer, finalize, getCurrentValue, getIdleTimeoutMs, idleTimeoutMs]);

  const handleInput = useCallback(() => {
    if (!enabled || captureMode !== 'input') return;
    const value = inputRef.current?.value ?? '';
    if (!capturingRef.current) {
      capturingRef.current = true;
      onCaptureStart?.();
    }
    onBufferUpdate?.(value);
    scheduleFinalize();
  }, [captureMode, enabled, onBufferUpdate, onCaptureStart, scheduleFinalize]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (!enabled || captureMode !== 'input') return;
      event.stopPropagation();
      if (event.key === 'Tab') {
        event.preventDefault();
        finalize();
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        stopCapture();
        resetValue();
        onCancel?.();
      }
    },
    [captureMode, enabled, finalize, onCancel, resetValue, stopCapture]
  );

  const handleBlur = useCallback(() => {
    if (!enabled) return;
    const allowRefocus = shouldKeepFocus ? shouldKeepFocus() : keepFocus;
    if (!allowRefocus) return;
    window.setTimeout(() => focusInput(), 0);
  }, [enabled, focusInput, keepFocus, shouldKeepFocus]);

  const setInputRef = useCallback(
    (node: HTMLTextAreaElement | null) => {
      inputRef.current = node;
      if (node && enabled) {
        focusInput();
      }
    },
    [enabled, focusInput]
  );

  useEffect(() => {
    if (!enabled) {
      stopCapture();
      resetValue();
      return;
    }
    resetValue();
    focusInput();
    return () => {
      stopCapture();
      resetValue();
    };
  }, [enabled, focusInput, resetValue, stopCapture]);

  useEffect(() => {
    if (!enabled || captureMode !== 'document') return;

    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      const now = Date.now();
      const gap = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      if (event.ctrlKey || event.metaKey || event.altKey) return;

      if (event.key === 'Escape') {
        if (!capturingRef.current) return;
        event.preventDefault();
        event.stopPropagation();
        stopCapture();
        resetValue();
        onCancel?.();
        return;
      }

      const isPrintable = event.key.length === 1;
      if (!isPrintable) {
        if (capturingRef.current) {
          event.preventDefault();
          event.stopPropagation();
        }
        return;
      }

      if (gap > humanGapMs) {
        bufferRef.current = '';
      }

      if (!capturingRef.current) {
        capturingRef.current = true;
        onCaptureStart?.();
      }

      bufferRef.current += event.key;
      onBufferUpdate?.(bufferRef.current);
      scheduleFinalize();
      event.preventDefault();
      event.stopPropagation();
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [
    captureMode,
    enabled,
    humanGapMs,
    onBufferUpdate,
    onCancel,
    onCaptureStart,
    resetValue,
    scheduleFinalize,
    stopCapture,
  ]);

  useEffect(() => {
    if (!enabled) return;
    const onFocusIn = (event: FocusEvent) => {
      const allowRefocus = shouldKeepFocus ? shouldKeepFocus() : keepFocus;
      if (!allowRefocus) return;
      const el = inputRef.current;
      if (!el) return;
      if (event.target === el || el.contains(event.target as Node)) return;
      queueRefocus();
    };
    const onVisibility = () => {
      const allowRefocus = shouldKeepFocus ? shouldKeepFocus() : keepFocus;
      if (document.visibilityState === 'visible' && allowRefocus) queueRefocus();
    };
    document.addEventListener('focusin', onFocusIn, true);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('focusin', onFocusIn, true);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [enabled, keepFocus, queueRefocus, shouldKeepFocus]);

  const handlers: ScanCaptureHandlers = {
    onBlur: handleBlur,
    onInput: handleInput,
    onKeyDown: handleKeyDown,
  };

  return {
    scanInputRef: setInputRef,
    scanInputHandlers: handlers,
    reset: () => {
      stopCapture();
      resetValue();
    },
    focusInput,
  };
}
