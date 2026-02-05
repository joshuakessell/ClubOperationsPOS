import type { ReactNode } from 'react';

export type KioskNoticeTone = 'info' | 'success' | 'warning';

export type KioskNotice = {
  tone?: KioskNoticeTone;
  title?: ReactNode;
  message?: ReactNode;
};
