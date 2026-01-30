import { useEffect, useMemo, useRef } from 'react';
import { RotateCw } from 'lucide-react';
import { useOrientation, type DeviceOrientation } from './useOrientation';

export type OrientationGuardProps = {
  required: DeviceOrientation;
  title?: string;
  message?: string;
  children: React.ReactNode;
};

export function OrientationGuard({
  required,
  title,
  message,
  children,
}: OrientationGuardProps): React.ReactNode {
  const { orientation } = useOrientation();
  const mismatch = orientation !== required;

  const resolvedTitle = title ?? 'Rotate iPad';
  const resolvedMessage =
    message ??
    `This screen must be used in ${required === 'portrait' ? 'portrait' : 'landscape'} mode.`;

  const mismatchText = useMemo(
    () => `OrientationGuard: expected ${required}, got ${orientation}`,
    [required, orientation]
  );

  const lastMismatch = useRef<boolean | null>(null);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (lastMismatch.current === mismatch) return;
    lastMismatch.current = mismatch;

    if (mismatch) console.info(mismatchText);
    else console.info(`OrientationGuard: orientation ok (${required})`);
  }, [mismatch, mismatchText, required]);

  if (!mismatch) return <>{children}</>;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 px-6 text-center text-white"
      role="alert"
      aria-live="assertive"
    >
      <div className="w-full max-w-sm rounded-3xl border border-white/20 bg-white/5 p-6 shadow-soft backdrop-blur">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
          <RotateCw className="h-7 w-7 text-white" />
        </div>
        <div className="text-xl font-semibold">{resolvedTitle}</div>
        <div className="mt-2 text-sm text-white/80">{resolvedMessage}</div>
      </div>
    </div>
  );
}
