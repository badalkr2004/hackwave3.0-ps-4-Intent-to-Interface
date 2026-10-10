import { useId, useState, type ReactNode } from 'react';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Circle,
  CircleCheck,
  CircleDot,
  CircleX,
  Frown,
  Inbox,
  Meh,
  OctagonAlert,
  Smile,
  X,
  type LucideIcon,
} from 'lucide-react';
import type { CommitmentStatus, EvidenceRef, Priority, TaskStatus } from '@gestalt/shared';
import { formatPct, sentimentLabel } from '../lib/format';

export type Tone = 'neutral' | 'accent' | 'danger' | 'warn' | 'success';

const TONE_CLASSES: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-muted',
  accent: 'bg-accent-bg text-accent-text',
  danger: 'bg-danger-bg text-danger',
  warn: 'bg-warn-bg text-warn',
  success: 'bg-success-bg text-success',
};

/** Shared status chip: fixed height, icon + text, tone variants. */
export function StatusBadge({
  tone,
  icon: Icon,
  children,
}: {
  tone: Tone;
  icon?: LucideIcon;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex h-6 shrink-0 items-center gap-1 rounded-sm px-2 text-xs font-medium whitespace-nowrap ${TONE_CLASSES[tone]}`}
    >
      {Icon && <Icon aria-hidden className="size-3.5" />}
      {children}
    </span>
  );
}

/** @deprecated Prefer StatusBadge — same API. */
export const Badge = StatusBadge;

/** Cap visible rows; "+N more" opens a detail dialog with the full list. */
export function TruncatedList<T>({
  items,
  limit,
  label,
  renderItem,
  keyOf,
}: {
  items: readonly T[];
  limit: number;
  label: string;
  renderItem: (item: T) => ReactNode;
  keyOf: (item: T) => string;
}) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const shown = items.slice(0, limit);
  const rest = items.length - shown.length;

  return (
    <>
      <ul className="flex flex-col gap-2">
        {shown.map((item) => (
          <li key={keyOf(item)}>{renderItem(item)}</li>
        ))}
      </ul>
      {rest > 0 && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="self-start text-13 font-medium text-accent-text underline-offset-2 hover:underline"
        >
          +{rest} more
        </button>
      )}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="fixed inset-0 z-50 flex items-end justify-center bg-text/30 p-4 sm:items-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false);
          }}
        >
          <div className="flex max-h-[80vh] w-full max-w-lg flex-col sheet">
            <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
              <h2 id={titleId} className="text-md font-medium text-text">
                {label}
              </h2>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setOpen(false)}
                className="inline-flex size-8 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-text"
              >
                <X aria-hidden className="size-4" />
              </button>
            </div>
            <ul className="flex flex-col gap-2 overflow-auto p-4">
              {items.map((item) => (
                <li key={keyOf(item)}>{renderItem(item)}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}

export function Delta({ pct, className = '' }: { pct: number | null; className?: string }) {
  if (pct === null) return <span className={`text-muted ${className}`}>No change data</span>;
  const tone = pct <= -5 ? 'text-danger' : pct >= 5 ? 'text-success' : 'text-muted';
  const Icon = pct <= -5 ? ArrowDownRight : pct >= 5 ? ArrowUpRight : ArrowRight;
  return (
    <span className={`inline-flex items-center gap-1 font-medium ${tone} ${className}`}>
      <Icon aria-hidden className="size-4" />
      {formatPct(pct)}
    </span>
  );
}

export function EmptyState({ message = 'Nothing to show for this scope.' }: { message?: string }) {
  return (
    <div className="flex h-full min-h-20 flex-col items-center justify-center gap-2 text-center text-sm text-muted">
      <Inbox aria-hidden className="size-5" />
      <p>{message}</p>
    </div>
  );
}

export function EvidenceChips({ items }: { items: EvidenceRef[] }) {
  if (items.length === 0) return null;
  return (
    <ul aria-label="Evidence" className="flex flex-wrap gap-1">
      {items.map((e) => (
        <li
          key={e.id}
          title={e.id}
          className="rounded-sm border border-border bg-surface-2 px-1.5 py-0.5 text-xs text-muted"
        >
          {e.label}
        </li>
      ))}
    </ul>
  );
}

export function GeneratedWithoutAiNote() {
  return <p className="mt-2 text-xs text-muted">Generated without AI from the data in scope.</p>;
}

const TASK_STATUS: Record<TaskStatus, { tone: Tone; icon: LucideIcon; label: string }> = {
  todo: { tone: 'neutral', icon: Circle, label: 'To do' },
  in_progress: { tone: 'accent', icon: CircleDot, label: 'In progress' },
  blocked: { tone: 'danger', icon: OctagonAlert, label: 'Blocked' },
  done: { tone: 'success', icon: CircleCheck, label: 'Done' },
};

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const s = TASK_STATUS[status];
  return (
    <Badge tone={s.tone} icon={s.icon}>
      {s.label}
    </Badge>
  );
}

const PRIORITY: Record<Priority, { tone: Tone; label: string }> = {
  high: { tone: 'danger', label: 'High' },
  medium: { tone: 'warn', label: 'Medium' },
  low: { tone: 'neutral', label: 'Low' },
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  const p = PRIORITY[priority];
  return (
    <Badge tone={p.tone} icon={priority === 'high' ? OctagonAlert : Circle}>
      {p.label}
    </Badge>
  );
}

const COMMITMENT: Record<CommitmentStatus, { tone: Tone; icon: LucideIcon; label: string }> = {
  missed: { tone: 'danger', icon: CircleX, label: 'Missed' },
  open: { tone: 'warn', icon: CircleDot, label: 'Open' },
  done: { tone: 'success', icon: CircleCheck, label: 'Done' },
};

export function CommitmentBadge({ status }: { status: CommitmentStatus }) {
  const c = COMMITMENT[status];
  return (
    <Badge tone={c.tone} icon={c.icon}>
      {c.label}
    </Badge>
  );
}

export function SentimentBadge({ value }: { value: number }) {
  const label = sentimentLabel(value);
  const tone: Tone = label === 'Positive' ? 'success' : label === 'Negative' ? 'danger' : 'neutral';
  const icon = label === 'Positive' ? Smile : label === 'Negative' ? Frown : Meh;
  return (
    <Badge tone={tone} icon={icon}>
      {label}
    </Badge>
  );
}

export function HealthBadge({ health }: { health: number }) {
  if (health < 60)
    return (
      <Badge tone="danger" icon={OctagonAlert}>
        At risk · {health}
      </Badge>
    );
  if (health < 75)
    return (
      <Badge tone="warn" icon={CircleDot}>
        Watch · {health}
      </Badge>
    );
  return (
    <Badge tone="success" icon={CircleCheck}>
      Healthy · {health}
    </Badge>
  );
}

/** Horizontal meter; the value is always shown as text by the caller. */
export function Meter({
  value,
  max = 100,
  tone = 'accent',
  marker,
}: {
  value: number;
  max?: number;
  tone?: 'accent' | 'danger' | 'warn' | 'success' | 'muted';
  marker?: number;
}) {
  const fill = {
    accent: 'bg-accent',
    danger: 'bg-danger',
    warn: 'bg-warn',
    success: 'bg-success',
    muted: 'bg-border-strong',
  }[tone];
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div aria-hidden className="relative h-2 w-full rounded-full bg-surface-2">
      <div className={`h-full rounded-full ${fill}`} style={{ width: `${pct}%` }} />
      {marker !== undefined && (
        <div
          className="absolute -top-1 h-4 w-0.5 bg-text"
          style={{ left: `${Math.min(100, (marker / max) * 100)}%` }}
        />
      )}
    </div>
  );
}

export function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-sm font-medium text-text">{children}</dd>
    </div>
  );
}
