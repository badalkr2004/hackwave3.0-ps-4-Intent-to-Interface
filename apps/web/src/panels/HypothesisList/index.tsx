import { SignalHigh, SignalLow, SignalMedium, type LucideIcon } from 'lucide-react';
import type { Confidence } from '@gestalt/shared';
import type { PanelViewProps } from '../types';
import { Badge, EmptyState, EvidenceChips, GeneratedWithoutAiNote, type Tone } from '../ui';

const CONFIDENCE: Record<Confidence, { label: string; icon: LucideIcon; tone: Tone }> = {
  high: { label: 'High confidence', icon: SignalHigh, tone: 'accent' },
  medium: { label: 'Medium confidence', icon: SignalMedium, tone: 'warn' },
  low: { label: 'Low confidence', icon: SignalLow, tone: 'neutral' },
};
const ORDER: Record<Confidence, number> = { high: 0, medium: 1, low: 2 };

export function HypothesisList({ props, size }: PanelViewProps<'hypothesis_list'>) {
  const hypotheses = [...props.hypotheses].sort(
    (a, b) => ORDER[a.confidence] - ORDER[b.confidence],
  );
  if (hypotheses.length === 0) return <EmptyState message="No hypotheses for this scope." />;
  const shown = size === 'L' ? hypotheses : hypotheses.slice(0, 3);

  return (
    <div>
      <ol className="flex flex-col gap-3">
        {shown.map((h, i) => {
          const c = CONFIDENCE[h.confidence];
          return (
            <li key={h.title} className="rounded-md border border-border p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h3 className="text-sm font-medium text-text">
                  <span className="text-muted">{i + 1}. </span>
                  {h.title}
                </h3>
                <Badge tone={c.tone} icon={c.icon}>
                  {c.label}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted">{h.explanation}</p>
              <div className="mt-2">
                <EvidenceChips items={h.evidence} />
              </div>
              <p className="mt-2 text-xs text-text">
                <span className="font-medium">How to confirm: </span>
                {h.howToConfirm}
              </p>
            </li>
          );
        })}
      </ol>
      {size !== 'L' && hypotheses.length > shown.length && (
        <p className="mt-2 text-xs text-muted">+{hypotheses.length - shown.length} less likely</p>
      )}
      {props.generatedWithoutAi && <GeneratedWithoutAiNote />}
    </div>
  );
}
