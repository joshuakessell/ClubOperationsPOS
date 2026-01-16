export type ToastVariant = 'info' | 'success' | 'error';

export type ToastItem = {
  id: string;
  title?: string;
  message: string;
  variant: ToastVariant;
  createdAt: number;
  durationMs: number;
};

