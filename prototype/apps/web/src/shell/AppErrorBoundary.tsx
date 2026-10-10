import { Component, type ErrorInfo, type ReactNode } from 'react';
import { CircleAlert, RotateCcw } from 'lucide-react';

interface State {
  error: Error | null;
}

/** Catches render failures above the panel level so a single bug cannot blank the whole app. */
export class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('App render failed', error, info.componentStack);
  }

  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-4 px-5 py-10">
        <p role="alert" className="flex items-start gap-3 rounded-lg bg-danger-bg p-4 text-danger">
          <CircleAlert aria-hidden className="mt-0.5 size-5 shrink-0" />
          <span>
            Something went wrong rendering the workspace.
            <span className="mt-1 block text-sm text-muted">
              Your session data is still on the server; reload to continue.
            </span>
          </span>
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-accent px-4 text-sm font-medium text-surface"
        >
          <RotateCcw aria-hidden className="size-4" />
          Reload
        </button>
      </div>
    );
  }
}
