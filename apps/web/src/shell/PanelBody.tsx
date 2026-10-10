import { Component, useState, type ErrorInfo, type ReactNode } from 'react';
import { RotateCcw } from 'lucide-react';
import type { Panel } from '@gestalt/shared';
import { getPanelEntry, PanelPropsError } from '../panels';
import { ErrorState } from '../panels/ui';

function PanelErrorState({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2">
      <ErrorState />
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex min-h-8 items-center gap-1 rounded-md border border-border px-3 text-sm text-text transition-colors duration-150 hover:bg-surface-2"
        >
          <RotateCcw aria-hidden className="size-4" /> Retry
        </button>
      )}
    </div>
  );
}

class PanelErrorBoundary extends Component<
  { children: ReactNode; onRetry: () => void },
  { failed: boolean }
> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    if (error instanceof PanelPropsError) {
      console.warn(error.message, error.issues);
    } else {
      console.error('Panel render failed', error, info.componentStack);
    }
  }

  override render() {
    if (this.state.failed) {
      return (
        <PanelErrorState
          onRetry={() => {
            this.setState({ failed: false });
            this.props.onRetry();
          }}
        />
      );
    }
    return this.props.children;
  }
}

export function PanelBody({ panel, lens }: { panel: Panel; lens: boolean }) {
  const [attempt, setAttempt] = useState(0);
  const entry = getPanelEntry(panel.componentId);

  if (!entry) {
    console.warn(`Unknown panel component "${panel.componentId}"`);
    return <p className="text-sm text-muted">This panel type is not available.</p>;
  }
  if (panel.status === 'loading') {
    return (
      <>
        <span className="sr-only">Loading…</span>
        <entry.skeleton size={panel.size} />
      </>
    );
  }
  if (panel.status === 'error') return <PanelErrorState />;

  return (
    <PanelErrorBoundary key={attempt} onRetry={() => setAttempt((n) => n + 1)}>
      <entry.Component props={panel.props} size={panel.size} lens={lens} />
    </PanelErrorBoundary>
  );
}
