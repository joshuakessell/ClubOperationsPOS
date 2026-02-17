import { useRef, useCallback, useEffect, useState, type ClipboardEvent, type KeyboardEvent } from 'react';

export interface OtpPinInputProps {
  /** Current PIN value (digits only). */
  value: string;
  /** Called whenever the PIN changes. */
  onChange: (pin: string) => void;
  /** Called when all digits have been entered. */
  onComplete?: (pin: string) => void;
  /** Number of digits. Default 6. */
  length?: number;
  /** Disable all inputs. */
  disabled?: boolean;
  /** Apply shake animation (e.g. on wrong PIN). */
  shake?: boolean;
  /** Auto-focus the first input on mount. */
  autoFocus?: boolean;
}

/**
 * OTP-style PIN input — large squares that auto-advance.
 * Keyboard-only (no on-screen numpad).  Supports paste.
 *
 * Shows a filled dot (●) for each entered digit.
 * Automatically calls `onComplete` once all digits are entered.
 */
export function OtpPinInput({
  value,
  onChange,
  onComplete,
  length = 6,
  disabled = false,
  shake = false,
  autoFocus = true,
}: OtpPinInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const completedRef = useRef(false);
  const [internalValue, setInternalValue] = useState(value);

  // Keep internal value in sync with external prop
  useEffect(() => {
    setInternalValue(value);
    // Reset completed flag when value is cleared (e.g. after error)
    if (value === '') {
      completedRef.current = false;
    }
  }, [value]);

  const digits = internalValue.padEnd(length, '').slice(0, length).split('');

  // Auto-focus on mount
  useEffect(() => {
    if (autoFocus && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [autoFocus]);

  // Auto-focus when value is cleared externally (e.g. after error reset)
  useEffect(() => {
    if (value === '' && autoFocus && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [value, autoFocus]);

  // Fire onComplete via effect to decouple from the synchronous input handler.
  // This ensures the parent state has settled before the callback fires.
  useEffect(() => {
    const cleaned = internalValue.replace(/[^0-9]/g, '');
    if (cleaned.length === length && !completedRef.current) {
      completedRef.current = true;
      // Small delay ensures rendering completes before triggering API call
      const timer = setTimeout(() => {
        onComplete?.(cleaned);
      }, 50);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [internalValue, length, onComplete]);

  const focusIndex = useCallback((i: number) => {
    const clamped = Math.max(0, Math.min(i, length - 1));
    inputRefs.current[clamped]?.focus();
  }, [length]);

  const updateValue = useCallback(
    (newDigits: string[]) => {
      const next = newDigits.join('').replace(/[^0-9]/g, '');
      setInternalValue(next);
      onChange(next);
    },
    [onChange]
  );

  const handleKeyDown = useCallback(
    (index: number, e: KeyboardEvent<HTMLInputElement>) => {
      if (disabled) return;

      if (e.key === 'Backspace') {
        e.preventDefault();
        const currentDigits = internalValue.padEnd(length, '').slice(0, length).split('');
        if (currentDigits[index] && currentDigits[index] !== ' ') {
          currentDigits[index] = '';
          updateValue(currentDigits);
        } else if (index > 0) {
          currentDigits[index - 1] = '';
          updateValue(currentDigits);
          focusIndex(index - 1);
        }
        completedRef.current = false;
        return;
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        focusIndex(index - 1);
        return;
      }

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        focusIndex(index + 1);
        return;
      }

      // Digit keys
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        const currentDigits = internalValue.padEnd(length, '').slice(0, length).split('');
        currentDigits[index] = e.key;
        updateValue(currentDigits);
        if (index < length - 1) {
          focusIndex(index + 1);
        }
      }
    },
    [disabled, focusIndex, internalValue, length, updateValue]
  );

  const handlePaste = useCallback(
    (e: ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      if (disabled) return;
      const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
      if (!pasted) return;
      setInternalValue(pasted);
      onChange(pasted);
      if (pasted.length < length) {
        focusIndex(pasted.length);
      }
    },
    [disabled, focusIndex, length, onChange]
  );

  return (
    <div
      className={[
        'flex items-center justify-center gap-3',
        shake ? 'animate-shake' : '',
      ].join(' ')}
      role="group"
      aria-label="PIN input"
    >
      {Array.from({ length }).map((_, i) => {
        const hasDig = digits[i] && digits[i] !== ' ' && /[0-9]/.test(digits[i]!);

        return (
          <input
            key={i}
            ref={(el) => { inputRefs.current[i] = el; }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={hasDig ? '●' : ''}
            disabled={disabled}
            autoComplete="one-time-code"
            aria-label={`PIN digit ${i + 1}`}
            className={[
              'h-16 w-14 rounded-xl border-2 bg-white/[0.07] text-center text-2xl font-bold text-white caret-transparent',
              'outline-none transition-all duration-200',
              'focus:border-brand-400 focus:ring-2 focus:ring-brand-400/30',
              hasDig ? 'border-white/30' : 'border-white/10',
              disabled ? 'cursor-not-allowed opacity-50' : '',
            ].join(' ')}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={handlePaste}
            onFocus={(e) => e.target.select()}
            onChange={() => {/* controlled via onKeyDown */}}
          />
        );
      })}
    </div>
  );
}
