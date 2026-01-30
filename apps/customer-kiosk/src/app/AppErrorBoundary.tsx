import React from 'react';
import { Button } from '../components/ui/button';

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
    console.error('App crashed:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="max-w-xl p-10 font-sans">
            <h2 className="text-2xl font-semibold">Something went wrong</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Please reload the page. If the issue persists, contact support.
            </p>
            <Button className="mt-6" onClick={() => window.location.reload()}>
              Reload
            </Button>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
