import React from 'react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

type Props = {
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

type State = {
  hasError: boolean;
  error?: unknown;
};

export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: unknown) {
    // Keep console logging; if you have telemetry, wire it here later.
    // eslint-disable-next-line no-console
    console.error('App crashed:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-white">
            <Card className="w-full max-w-xl bg-slate-900/70 ring-slate-700 text-white">
              <h2 className="text-2xl font-bold">Something went wrong</h2>
              <p className="mt-2 text-white/80">
                Please reload the page. If the issue persists, contact support.
              </p>
              <div className="mt-6 flex justify-end">
                <Button onClick={() => window.location.reload()}>Reload</Button>
              </div>
            </Card>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
