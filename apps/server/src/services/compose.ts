import {
  MANIFESTS,
  MANIFESTS_BY_ID,
  computeDiff,
  type Intent,
  type Panel,
  type UISpec,
} from '@gestalt/shared';
import { getDb } from '../db/client';
import { getDbState } from '../db/state';
import { startOfDay } from '../lib/dates';
import { current, pushSpec, type Session } from '../session';
import { runAuction, type ComponentData } from './auction';
import { componentData, loadScopeData } from './data';
import { planNeeds } from './needs';

export interface DeferredJob {
  panelId: string;
  /** Resolves the generated props for a deferred panel. */
  run: () => Promise<{ props: Record<string, unknown>; degraded: boolean }>;
}

export interface Composition {
  spec: UISpec;
  deferred: DeferredJob[];
}

async function auctionData(intent: Intent): Promise<Record<string, ComponentData>> {
  const db = getDbState() === 'up' ? getDb() : null;
  if (!db)
    return Object.fromEntries(
      MANIFESTS.map((m) => [m.id, { props: null, signal: 0, evidence: [] }]),
    );
  const data = await loadScopeData(db, intent.scope, startOfDay(new Date()));
  return componentData(data, intent.shape);
}

const asRecord = (props: unknown): Record<string, unknown> =>
  props && typeof props === 'object' ? (props as Record<string, unknown>) : {};

/**
 * Builds the next composition for an intent and pushes it onto the session stack. Deferred panels
 * are emitted as `loading` and returned as jobs, so callers can stream them as patches.
 */
export async function compose(
  session: Session,
  intent: Intent,
  opts: { degraded: boolean; replaceTop: boolean },
): Promise<Composition> {
  const needs = planNeeds(intent.shape, session.pinned);
  const data = await auctionData(intent);
  const {
    panels: planned,
    receipts,
    excluded,
  } = runAuction({
    shape: intent.shape,
    needs,
    manifests: MANIFESTS,
    data,
    pinned: session.pinned,
    dismissed: session.dismissed,
  });

  const deferred: DeferredJob[] = [];
  const panels: Panel[] = planned.map((p) => {
    const isDeferred = MANIFESTS_BY_ID[p.componentId]?.deferred ?? false;
    const props = asRecord(data[p.componentId]?.props);
    if (isDeferred) {
      // M2: the rule-based copy computed by the loader is the generated content.
      deferred.push({ panelId: p.componentId, run: async () => ({ props, degraded: false }) });
    }
    return {
      id: p.componentId,
      componentId: p.componentId,
      need: p.need,
      question: p.question,
      size: p.size,
      zone: p.zone,
      order: p.order,
      status: isDeferred ? 'loading' : 'ready',
      pinned: p.pinned,
      props: isDeferred ? {} : props,
    };
  });

  const prev = current(session);
  session.version += 1;
  const spec: UISpec = {
    id: `${session.id.slice(0, 8)}-v${session.version}`,
    version: session.version,
    intent,
    needs,
    panels,
    receipts,
    excluded,
    diff: computeDiff(prev, { panels }),
    degraded: opts.degraded,
  };
  pushSpec(session, spec, opts.replaceTop);
  return { spec, deferred };
}

/** Applies a finished deferred job to the stored spec so Back and refresh show the final content. */
export function applyPatch(
  spec: UISpec,
  panelId: string,
  props: Record<string, unknown>,
  ok: boolean,
): void {
  const panel = spec.panels.find((p) => p.id === panelId);
  if (!panel) return;
  panel.props = props;
  panel.status = ok ? 'ready' : 'error';
}

/** Composes and resolves deferred panels inline (for non-streaming routes like pin and dismiss). */
export async function composeNow(
  session: Session,
  intent: Intent,
  opts: { degraded: boolean; replaceTop: boolean },
): Promise<UISpec> {
  const { spec, deferred } = await compose(session, intent, opts);
  for (const job of deferred) {
    try {
      const { props, degraded } = await job.run();
      applyPatch(spec, job.panelId, props, true);
      if (degraded) spec.degraded = true;
    } catch {
      applyPatch(spec, job.panelId, {}, false);
    }
  }
  return spec;
}
