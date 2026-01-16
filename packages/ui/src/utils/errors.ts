import { getErrorMessage, isRecord } from './typeGuards';

function isDev(): boolean {
  // Vite (apps) path
  try {
    const meta = import.meta as unknown as { env?: Record<string, unknown> };
    if (meta?.env && typeof meta.env['DEV'] === 'boolean') return Boolean(meta.env['DEV']);
  } catch {
    // ignore
  }
  // Fallback (tests/node)
  return typeof process !== 'undefined' ? process.env.NODE_ENV !== 'production' : true;
}

export function logDevError(error: unknown, context?: string): void {
  if (!isDev()) return;
  // eslint-disable-next-line no-console
  console.error(context ? `[${context}]` : '[error]', error);
}

/**
 * Convert unknown errors into a user-facing message suitable for non-blocking toasts.
 * Understands `{ message }`, `{ error }`, and ApiError-like `{ status, body }` shapes.
 */
export function getToastErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (error instanceof Error && error.message.trim()) return error.message;

  if (isRecord(error)) {
    const msg = getErrorMessage(error);
    if (msg) return msg;

    // ApiError-like shape (apps may implement their own ApiError class)
    const body = error['body'];
    if (body) {
      const fromBody = getErrorMessage(body);
      if (fromBody) return fromBody;
    }
  }

  return fallback;
}

