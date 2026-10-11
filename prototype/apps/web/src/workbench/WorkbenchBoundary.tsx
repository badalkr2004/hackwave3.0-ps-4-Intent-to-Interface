import { Component, type ErrorInfo, type ReactNode } from 'react';
import type { Exclusion, UISpec } from '@gestalt/shared';
import { ZoneGrid } from '../shell/ZoneGrid';

interface Props {
  spec: UISpec;
  lensOn: boolean;
  onTogglePin: (componentId: string, pinned: boolean) => void;
  onDismiss: (componentId: string) => void;
  onBringBack: (item: Exclusion) => void;
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** If the task canvas crashes, fall back to the proven zone grid so the demo continues. */
export class WorkbenchBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Workbench render failed; falling back to zone grid', error, info.componentStack);
  }

  override componentDidUpdate(prev: Props): void {
    if (prev.spec.id !== this.props.spec.id && this.state.error) {
      this.setState({ error: null });
    }
  }

  override render() {
    if (!this.state.error) return this.props.children;
    const { spec, lensOn, onTogglePin, onDismiss } = this.props;
    return (
      <div className="flex flex-col gap-3">
        <p role="status" className="rounded-md border border-warn/40 bg-warn-bg px-3 py-2 text-13 text-warn">
          Task canvas hit a snag — showing the classic layout instead. ({this.state.error.message})
        </p>
        <ZoneGrid
          panels={spec.panels}
          lensOn={lensOn}
          receipts={spec.receipts}
          needs={spec.needs}
          onTogglePin={onTogglePin}
          onDismiss={onDismiss}
        />
      </div>
    );
  }
}
