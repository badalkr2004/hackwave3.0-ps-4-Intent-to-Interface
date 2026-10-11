import { motion, useReducedMotion } from 'framer-motion';
import type { Intent, Shape } from '@gestalt/shared';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { cn } from '../lib/utils';
import { HEADLINE_ID } from '../shell/ids';

const SHAPE_LABEL: Record<Shape, string> = {
  overview: 'Overview',
  prepare: 'Meeting prep',
  diagnose: 'Investigation',
  triage: 'Triage',
};

const SHAPE_HINT: Record<Shape, string> = {
  overview: 'Portfolio pulse — pick a goal to reshape the workbench',
  prepare: 'Build a meeting brief and close readiness gaps',
  diagnose: 'Walk the evidence chain and lock a root cause',
  triage: 'Clear blockers and shrink the overdue queue',
};

export function TaskHeader({
  intent,
  readiness,
  gaps,
  className,
}: {
  intent: Intent;
  readiness: number;
  gaps: string[];
  className?: string;
}) {
  const reduced = useReducedMotion();
  const readyLabel =
    readiness >= 80 ? 'Ready' : readiness >= 55 ? 'Almost there' : readiness >= 35 ? 'In progress' : 'Not ready';

  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-lg border border-border bg-surface/80 p-4 backdrop-blur-sm sm:p-5',
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{
          background:
            'radial-gradient(ellipse 80% 120% at 0% 0%, var(--gradient-a), transparent 55%), radial-gradient(ellipse 60% 80% at 100% 20%, var(--gradient-b), transparent 50%)',
        }}
      />
      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="accent">{SHAPE_LABEL[intent.shape]}</Badge>
            {intent.scope.clientId && (
              <Badge>Scoped · {intent.scope.timeRange}</Badge>
            )}
            <Badge variant={readiness >= 80 ? 'success' : readiness >= 55 ? 'warn' : 'default'}>
              {readyLabel}
            </Badge>
          </div>
          <h1
            id={HEADLINE_ID}
            tabIndex={-1}
            className="mt-2 font-display text-2xl tracking-tight text-text outline-none sm:text-[2rem]"
          >
            {intent.headline}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">{intent.summary || SHAPE_HINT[intent.shape]}</p>
        </div>

        <div className="w-full shrink-0 lg:w-56">
          <div className="mb-1.5 flex items-baseline justify-between text-13">
            <span className="text-muted">Readiness</span>
            <motion.span
              key={readiness}
              initial={reduced ? false : { opacity: 0.4, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="tabular font-medium text-accent-text"
            >
              {readiness}%
            </motion.span>
          </div>
          <Progress value={readiness} />
        </div>
      </div>

      {gaps.length > 0 && (
        <ul className="relative mt-4 flex flex-col gap-1.5 border-t border-border/80 pt-3">
          {gaps.map((g) => (
            <li key={g} className="flex items-start gap-2 text-13 text-muted">
              <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-warn" />
              <span>{g}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
