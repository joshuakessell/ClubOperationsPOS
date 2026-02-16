import { Component, type ReactNode, type ErrorInfo } from 'react';

interface RouteErrorBoundaryProps {
  /** Label for the route, shown in the error fallback. */
  routeName: string;
  children: ReactNode;
}

interface RouteErrorBoundaryState {
  error: Error | null;
}

/**
 * Lightweight error boundary that wraps individual routes.
 * If a view crashes, only that route shows the fallback —
 * the sidebar, navigation, and other routes stay alive.
 */
export class RouteErrorBoundary extends Component<RouteErrorBoundaryProps, RouteErrorBoundaryState> {
  constructor(props: RouteErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): RouteErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[RouteErrorBoundary] ${this.props.routeName} crashed:`, error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center gap-4 p-8 text-center">
          <h3 className="text-xl font-semibold text-error-400">
            Something went wrong in {this.props.routeName}
          </h3>
          <p className="max-w-md text-sm text-gray-400">
            {this.state.error.message}
          </p>
          <button
            className="rounded-lg px-4 py-2 text-sm font-semibold text-gray-300 ring-1 ring-inset ring-gray-700 hover:bg-white/[0.05] transition-colors"
            onClick={() => this.setState({ error: null })}
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
