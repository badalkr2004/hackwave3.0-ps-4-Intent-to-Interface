import { HandHeart, HelpCircle, ShieldAlert, Handshake, type LucideIcon } from 'lucide-react';
import type { TalkingPointType } from '@gestalt/shared';
import type { PanelViewProps } from '../types';
import { EmptyState, EvidenceChips, GeneratedWithoutAiNote } from '../ui';

const GROUPS: { type: TalkingPointType; label: string; icon: LucideIcon }[] = [
  { type: 'acknowledge', label: 'Acknowledge', icon: HandHeart },
  { type: 'ask', label: 'Ask', icon: HelpCircle },
  { type: 'commit', label: 'Commit', icon: Handshake },
  { type: 'risk', label: 'Risk', icon: ShieldAlert },
];

export function TalkingPoints({ props, size }: PanelViewProps<'talking_points'>) {
  if (props.points.length === 0) return <EmptyState message="No talking points for this scope." />;

  return (
    <div>
      <div className={`grid gap-4 ${size === 'L' ? 'md:grid-cols-2' : ''}`}>
        {GROUPS.map(({ type, label, icon: Icon }) => {
          const points = props.points.filter((p) => p.type === type);
          if (points.length === 0) return null;
          return (
            <section key={type} aria-labelledby={`tp-${type}`}>
              <h3
                id={`tp-${type}`}
                className={`mb-2 inline-flex items-center gap-1 text-xs font-medium tracking-wide uppercase ${type === 'risk' ? 'text-danger' : 'text-accent-text'}`}
              >
                <Icon aria-hidden className="size-4" />
                {label}
              </h3>
              <ul className="flex flex-col gap-3">
                {points.map((p) => (
                  <li key={p.headline}>
                    <p className="text-sm font-medium text-text">{p.headline}</p>
                    <p className="mt-0.5 text-sm text-muted">{p.detail}</p>
                    <div className="mt-1">
                      <EvidenceChips items={p.evidence} />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
      {props.generatedWithoutAi && <GeneratedWithoutAiNote />}
    </div>
  );
}
