import { useEffect, useMemo } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { UISpec } from '@gestalt/shared';
import type { ActionItem } from '../panels/types';
import { ActionRail } from './ActionRail';
import { EvidenceStrip } from './EvidenceStrip';
import { extractWorkbench, taskGaps } from './extract';
import { InvestigationCanvas } from './InvestigationCanvas';
import { MeetingBriefCanvas } from './MeetingBriefCanvas';
import { OverviewCanvas } from './OverviewCanvas';
import { TaskHeader } from './TaskHeader';
import { TriageCanvas } from './TriageCanvas';
import { computeReadiness, useTaskState } from './taskState';

export function Workbench({
  spec,
  onRunAction,
  onPrompt,
}: {
  spec: UISpec;
  onRunAction: (action: ActionItem) => void;
  onPrompt: (text: string) => void;
}) {
  const reduced = useReducedMotion();
  const data = useMemo(() => extractWorkbench(spec), [spec]);
  const gaps = useMemo(() => taskGaps(spec, data), [spec, data]);
  const {
    resetForSpec,
    checkedPoints,
    hypothesisVerdicts,
    snoozedTasks,
    clearedBlockers,
  } = useTaskState();

  useEffect(() => {
    resetForSpec(spec.id);
  }, [spec.id, resetForSpec]);

  const points = Array.isArray(data.talkingPoints?.points) ? data.talkingPoints.points : [];
  const checkedCount = points.filter((_, i) => checkedPoints[`tp-${i}`]).length;
  const hasAcceptedHypothesis = Object.values(hypothesisVerdicts).some((v) => v === 'accepted');
  const overdueTasks = Array.isArray(data.overdue?.tasks) ? data.overdue.tasks : [];
  const blockerTasks = Array.isArray(data.blockers?.tasks) ? data.blockers.tasks : [];
  const overdueTotal = overdueTasks.length;
  const overdueRemaining =
    overdueTasks.filter((t) => !snoozedTasks[t.id]).length +
    blockerTasks.filter((t) => t.status === 'blocked' && !clearedBlockers[t.id]).length;

  const readiness = computeReadiness({
    shape: spec.intent.shape,
    pointCount: points.length,
    checkedCount,
    hasAcceptedHypothesis,
    overdueRemaining,
    overdueTotal: Math.max(overdueTotal, 1),
    gapCount: gaps.length,
  });

  const nextMoves = buildNextMoves(spec.intent.shape, gaps, {
    checkedCount,
    pointCount: points.length,
    hasAcceptedHypothesis,
    overdueRemaining,
  });

  const canvasKey = `${spec.id}:${spec.intent.shape}`;

  return (
    <div className="flex flex-col gap-5">
      <TaskHeader intent={spec.intent} readiness={readiness} gaps={gaps} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={canvasKey}
              initial={reduced ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
            >
              {spec.intent.shape === 'prepare' ? (
                <MeetingBriefCanvas data={data} />
              ) : spec.intent.shape === 'diagnose' ? (
                <InvestigationCanvas data={data} />
              ) : spec.intent.shape === 'triage' ? (
                <TriageCanvas data={data} />
              ) : (
                <OverviewCanvas data={data} onPrompt={onPrompt} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {spec.intent.shape !== 'overview' && (
          <ActionRail
            actions={data.actions?.actions}
            nextMoves={nextMoves}
            onRun={onRunAction}
          />
        )}
      </div>

      {spec.intent.shape !== 'overview' && (
        <EvidenceStrip
          panels={
            data.evidencePanels.length
              ? data.evidencePanels
              : spec.panels
                  .filter((p) =>
                    ['usage_trend', 'comms_timeline', 'client_snapshot', 'release_strip'].includes(
                      p.componentId,
                    ),
                  )
                  .slice(0, 3)
          }
        />
      )}
    </div>
  );
}

function buildNextMoves(
  shape: string,
  gaps: string[],
  ctx: {
    checkedCount: number;
    pointCount: number;
    hasAcceptedHypothesis: boolean;
    overdueRemaining: number;
  },
): string[] {
  if (shape === 'prepare') {
    const moves = [...gaps];
    if (ctx.pointCount && ctx.checkedCount < ctx.pointCount) {
      moves.unshift(`Cover ${ctx.pointCount - ctx.checkedCount} remaining talk-track items`);
    }
    moves.push('Draft the pre-meeting email when ready');
    return moves.slice(0, 3);
  }
  if (shape === 'diagnose') {
    if (!ctx.hasAcceptedHypothesis) {
      return ['Accept the strongest hypothesis', ...gaps].slice(0, 3);
    }
    return ['Notify engineering with the locked cause', 'Draft a customer update'].slice(0, 3);
  }
  if (shape === 'triage') {
    if (ctx.overdueRemaining > 0) {
      return [`Clear or snooze ${ctx.overdueRemaining} remaining items`, ...gaps].slice(0, 3);
    }
    return ['Queue is clear — return to overview or pick a client'];
  }
  return gaps.slice(0, 3);
}
