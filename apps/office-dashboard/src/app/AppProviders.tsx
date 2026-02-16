import React from 'react';
import { AppErrorBoundary } from './AppErrorBoundary';

/**
 * AppProviders wraps the app with error boundary.
 * The MUI ThemeProvider from before has been replaced by the TailAdmin
 * ThemeProvider at the main.tsx level + Tailwind v4 CSS theming.
 */
type Props = { children: React.ReactNode };

export function AppProviders({ children }: Props) {
  return (
    <AppErrorBoundary>
      {children}
    </AppErrorBoundary>
  );
}
