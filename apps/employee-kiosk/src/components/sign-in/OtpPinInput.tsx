import { useRef, useCallback, useEffect, type ClipboardEvent, type KeyboardEvent } from 'react';

export interface OtpPinInputProps {
  /** Current PIN value (digits only). */
  value: string;
  /** Called whenever the PIN changes. */
  onChange: (pin: string) => void;
  /** Called when all 6 digits have been entered. */
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
 * OTP-style PIN input — 6 large white squares that auto-advance.
 * Keyboard-only (no on-screen numpad).  Supports paste.
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
  const digits = value.padEnd(length, '').slice(0, length).split('');

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

  const focusIndex = useCallback((i: number) => {
    const clamped = Math.max(0, Math.min(i, length - 1));
    inputRefs.current[clamped]?.focus();
  }, [length]);

  const setDigit = useCallback(
    (index: number, digit: string) => {
      const next = digits.map((d, i) => (i === index ? digit : d)).join('').replace(/[^0-9]/g, '');
      onChange(next);
      if (next.length === length) {
        onComplete?.(next);
      }
    },
    [digits, length, onChange, onComplete]
  );

  const handleKeyDown = useCallback(
    (index: number, e: KeyboardEvent<HTMLInputElement>) => {
      if (disabled) return;

      if (e.key === 'Backspace') {
        e.preventDefault();
        if (digits[index] && digits[index] !== '') {
          setDigit(index, '');
        } else if (index > 0) {
          setDigit(index - 1, '');
          focusIndex(index - 1);
        }
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
        setDigit(index, e.key);
        if (index < length - 1) {
          focusIndex(index + 1);
        }
      }
    },
    [digits, disabled, focusIndex, length, setDigit]
  );

  const handlePaste = useCallback(
    (e: ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      if (disabled) return;
      const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
      if (!pasted) return;
      onChange(pasted);
      if (pasted.length === length) {
        onComplete?.(pasted);
      } else {
        focusIndex(pasted.length);
      }
    },
    [disabled, focusIndex, length, onChange, onComplete]
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
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => { inputRefs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digits[i] && digits[i] !== ' ' ? '●' : ''}
          disabled={disabled}
          autoComplete="one-time-code"
          aria-label={`PIN digit ${i + 1}`}
          className={[
            'h-16 w-14 rounded-xl border-2 bg-white/[0.07] text-center text-2xl font-bold text-white',
            'outline-none transition-all duration-200',
            'focus:border-brand-400 focus:ring-2 focus:ring-brand-400/30',
            digits[i] && digits[i] !== ' '
              ? 'border-white/30'
              : 'border-white/10',
            disabled ? 'cursor-not-allowed opacity-50' : '',
          ].join(' ')}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          onChange={() => {/* controlled via onKeyDown */}}
        />
      ))}
    </div>
  );
}
