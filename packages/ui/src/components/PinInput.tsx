import { useCallback, useMemo, useState } from 'react';
import { Button } from './Button';

export type PinInputProps = {
  /** Fixed PIN length (e.g. 6). If set, submit is disabled until exact length is reached. */
  length?: number;
  /** Max length when `length` is not set. Defaults to unlimited. */
  maxLength?: number;

  value?: string;
  defaultValue?: string;
  onChange?: (pin: string) => void;

  onSubmit?: (pin: string) => void;
  submitLabel?: string;
  submitDisabled?: boolean;

  disabled?: boolean;
  className?: string;
  displayAriaLabel?: string;
};

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(' ');
}

function clampDigits(raw: string, max: number): string {
  const digitsOnly = raw.replace(/\D/g, '');
  if (!Number.isFinite(max)) return digitsOnly;
  if (max <= 0) return '';
  return digitsOnly.slice(0, max);
}

export function PinInput({
  length,
  maxLength,
  value,
  defaultValue,
  onChange,
  onSubmit,
  submitLabel = 'Enter',
  submitDisabled,
  disabled,
  className,
  displayAriaLabel = 'PIN',
}: PinInputProps) {
  const max = Number.isFinite(length) ? Number(length) : Number.isFinite(maxLength) ? Number(maxLength) : Infinity;

  const isControlled = value !== undefined;
  const [uncontrolled, setUncontrolled] = useState<string>(() => clampDigits(defaultValue ?? '', max));
  const pin = clampDigits(isControlled ? String(value ?? '') : uncontrolled, max);

  const setPin = useCallback(
    (next: string) => {
      const cleaned = clampDigits(next, max);
      if (!isControlled) setUncontrolled(cleaned);
      onChange?.(cleaned);
    },
    [isControlled, max, onChange]
  );

  const canSubmit = useMemo(() => {
    if (disabled) return false;
    if (!onSubmit) return false;
    if (submitDisabled) return false;
    if (Number.isFinite(length)) return pin.length === Number(length);
    return pin.length > 0;
  }, [disabled, length, onSubmit, pin.length, submitDisabled]);

  const doSubmit = useCallback(() => {
    if (!canSubmit) return;
    onSubmit?.(pin);
  }, [canSubmit, onSubmit, pin]);

  const onDigit = useCallback(
    (d: number) => {
      if (disabled) return;
      setPin(pin + String(d));
    },
    [disabled, pin, setPin]
  );

  const onBackspace = useCallback(() => {
    if (disabled) return;
    setPin(pin.slice(0, -1));
  }, [disabled, pin, setPin]);

  const onClear = useCallback(() => {
    if (disabled) return;
    setPin('');
  }, [disabled, setPin]);

  const displaySlots = Number.isFinite(length) ? Number(length) : Math.max(pin.length, 6);

  return (
    <div className={cn('w-full', className)}>
      <div
        aria-label={displayAriaLabel}
        className="mb-4 flex justify-center gap-2"
        role="group"
      >
        {Array.from({ length: displaySlots }).map((_, i) => (
          <div
            key={i}
            data-filled={i < pin.length ? 'true' : 'false'}
            className={cn(
              'h-3 w-3 rounded-full ring-1 ring-gray-300',
              i < pin.length ? 'bg-gray-900' : 'bg-white'
            )}
          />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
          <Button key={d} variant="secondary" onClick={() => onDigit(d)} disabled={disabled}>
            {d}
          </Button>
        ))}
        <Button variant="secondary" onClick={onClear} disabled={disabled}>
          Clear
        </Button>
        <Button variant="secondary" onClick={() => onDigit(0)} disabled={disabled}>
          0
        </Button>
        <Button variant="secondary" onClick={onBackspace} disabled={disabled}>
          ⌫
        </Button>
      </div>

      <div className="mt-3">
        <Button className="w-full" onClick={doSubmit} disabled={!canSubmit}>
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}

