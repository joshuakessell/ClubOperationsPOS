import { useMemo } from 'react';
import type { ToastNotifier } from './notifications';

type PushBottomToast = (toast: { message: string; tone: 'warning' | 'info' }) => void;

export function useToastNotifier(pushBottomToast: PushBottomToast): ToastNotifier {
  return useMemo(
    () => ({
      warn: (message) => pushBottomToast({ message, tone: 'warning' }),
      info: (message) => pushBottomToast({ message, tone: 'info' }),
    }),
    [pushBottomToast]
  );
}
