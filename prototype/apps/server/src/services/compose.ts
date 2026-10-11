import {
  MANIFESTS,
  MANIFESTS_BY_ID,
  computeDiff,
  type Intent,
  type Need,
  type Panel,
  type PanelProps,
  type UISpec,
} from '@gestalt/shared';
import { getDb } from '../db/client';
import { getDbState } from '../db/state';
import { startOfDay } from '../lib/dates';
import { current, pushSpec, type Session } from '../session';
import { runAuction, type ComponentData, type PlannedPanel } from './auction';
import { generateCopy, type CopyId } from './copy';
import { filterNeedsForRole } from './accessPolicy';
import { componentData, loadScopeData, type ScopeData } from './data';
import { buildDigest, type Digest } from './digest';
import { planNeeds, withJiraBoost, withPins, withSalesVizBoost } from './needs';

export interface DeferredJob {
  panelId: string;
  /** Generated props for a deferred panel; `null` means it could not be produced. */
  run: () => Promise<{ props: Record<string, unknown>; degraded: boolean } | null>;
}

export interface Composition {
  spec: UISpec;
  /** Needs before pins were applied, reused by pin and dismiss without a new LLM call. */
  baseNeeds: Need[];
  deferred: DeferredJob[];
}

export interface ComposeOptions {
  /** True if an earlier stage (intent parsing) already fell back. */
  degraded: boolean;
  /** Reuse these needs instead of planning (pin, dismiss). */
  reuseNeeds?: Need[];
  /** Reuse generated copy from this composition instead of writing it again (pin, dismiss). */
  reuseCopyFrom?: UISpec;
  signal?: AbortSignal;
  /** Called between stages so the route can stream status events. */
  onStage?: (stage: 'fetching' | 'planning' | 'composing') => void;
}

const emptyData = (): Record<string, ComponentData> =>
  Object.fromEntries(MANIFESTS.map((m) => [m.id, { props: null, signal: 0, evidence: [] }]));

const asRecord = (props: unknown): Record<string, unknown> =>
  props && typeof props === 'object' ? (props as Record<string, unknown>) : {};

async function loadData(session: Session, intent: Intent): Promise<ScopeData | null> {
  const db = getDbState() === 'up' ? getDb() : null;
  return db
    ? loadScopeData(
        db,
        intent.scope,
        startOfDay(new Date()),
        session.allowedClientIds,
        session.organizationId,
        session.userId,
        session.accessRole,
      )
    : null;
}

/**
 * Builds the next composition for an intent (Section 11.3). Does not touch the session stack;
 * call `commit` once the request is known to be current.
 */
export async function compose(
  session: Session,
  intent: Intent,
  opts: ComposeOptions,
): Promise<Composition> {
  opts.onStage?.('fetching');
  const data = await loadData(session, intent);
  const digest: Digest | null = data ? await buildDigest(data.ctx) : null;

  opts.onStage?.('planning');
  let degraded = opts.degraded;
  let baseNeeds = opts.reuseNeeds;
  if (!baseNeeds) {
    const planned = await planNeeds(intent.shape, digest, intent.scope.clientId, opts.signal);
    baseNeeds = planned.needs;
    degraded ||= planned.degraded;
  }
  if (session.preferredViz) baseNeeds = withSalesVizBoost(baseNeeds);
  if (session.jiraFocus) baseNeeds = withJiraBoost(baseNeeds);
  baseNeeds = filterNeedsForRole(baseNeeds, session.accessRole);
  const needs = withPins(baseNeeds, session.pinned);

  opts.onStage?.('composing');
  const cd = data ? await componentData(data, intent.shape) : emptyData();
  applyPreferredViz(cd, session);
  applyJiraFocus(cd, session);
  const {
    panels: planned,
    receipts,
    excluded,
  } = runAuction({
    shape: intent.shape,
    needs,
    manifests: MANIFESTS,
    data: cd,
    pinned: session.pinned,
    dismissed: session.dismissed,
  });

  if (session.preferredViz) featureSalesPulse(planned);
  if (session.jiraFocus) featureJiraTickets(planned);

  const deferred: DeferredJob[] = [];
  const panels: Panel[] = planned.map((p) => {
    const written = opts.reuseCopyFrom?.panels.find(
      (x) => x.id === p.componentId && x.status === 'ready',
    );
    const isDeferred = (MANIFESTS_BY_ID[p.componentId]?.deferred ?? false) && !!digest && !written;
    if (written && MANIFESTS_BY_ID[p.componentId]?.deferred) {
      cd[p.componentId] = { ...cd[p.componentId]!, props: written.props };
    }
    if (isDeferred) {
      deferred.push({
        panelId: p.componentId,
        run: async () => {
          const res = await generateCopy(
            p.componentId as CopyId,
            digest!,
            intent.scope.clientId,
            opts.signal,
          );
          return res && { props: asRecord(res.props), degraded: res.degraded };
        },
      });
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
      props: isDeferred ? {} : asRecord(cd[p.componentId]?.props),
    };
  });

  const version = session.version + 1;
  const spec: UISpec = {
    id: `${session.id.slice(0, 8)}-v${version}`,
    version,
    intent,
    needs,
    panels,
    receipts,
    excluded,
    diff: computeDiff(current(session), { panels }),
    degraded,
  };
  return { spec, baseNeeds, deferred };
}

/** Records a finished composition: pushes it (or replaces the top) and remembers its needs. */
export function commit(session: Session, c: Composition, replaceTop: boolean): void {
  session.version = c.spec.version;
  session.baseNeeds.set(c.spec, c.baseNeeds);
  pushSpec(session, c.spec, replaceTop);
}

/** Applies a finished deferred job to the stored spec so Back restores the final content. */
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

/** Runs every deferred job, patching the spec in place and reporting each result. */
export async function fillDeferred(
  spec: UISpec,
  jobs: DeferredJob[],
  onPatch?: (panelId: string, ok: boolean, props: Record<string, unknown>) => void,
): Promise<void> {
  await Promise.all(
    jobs.map(async (job) => {
      let result: Awaited<ReturnType<DeferredJob['run']>> = null;
      try {
        result = await job.run();
      } catch {
        result = null;
      }
      const ok = result !== null;
      const props = result?.props ?? {};
      if (!ok || result?.degraded) spec.degraded = true;
      applyPatch(spec, job.panelId, props, ok);
      onPatch?.(job.panelId, ok, props);
    }),
  );
}

/** Composes, resolves deferred panels inline, and commits (non-streaming routes). */
export async function composeNow(
  session: Session,
  intent: Intent,
  opts: ComposeOptions & { replaceTop: boolean },
): Promise<UISpec> {
  const c = await compose(session, intent, opts);
  await fillDeferred(c.spec, c.deferred);
  if (opts.signal?.aborted) throw new SupersededError();
  commit(session, c, opts.replaceTop);
  return c.spec;
}

/** A newer request replaced this one before it could commit. */
export class SupersededError extends Error {
  constructor() {
    super('Superseded by a newer request');
  }
}

/** Stamps preferredChart onto sales_pulse props and boosts its auction signal. */
function applyPreferredViz(cd: Record<string, ComponentData>, session: Session): void {
  const chart = session.preferredViz;
  if (!chart) return;
  const row = cd.sales_pulse;
  if (!row?.props || typeof row.props !== 'object') return;
  const props = {
    ...(row.props as PanelProps<'sales_pulse'>),
    preferredChart: chart,
  };
  cd.sales_pulse = {
    ...row,
    props,
    signal: Math.max(row.signal, 0.95),
  };
}

/** Center-stage the sales pulse at L when the user asked for a chart format. */
function featureSalesPulse(panels: PlannedPanel[]): void {
  const sales = panels.find((p) => p.componentId === 'sales_pulse');
  if (!sales) return;
  sales.zone = 'center';
  sales.size = 'L';
  sales.order = 0;
}

/** Stamp focused + boost signal when the user asked about Jira. */
function applyJiraFocus(cd: Record<string, ComponentData>, session: Session): void {
  if (!session.jiraFocus) return;
  const row = cd.jira_tickets;
  if (!row?.props || typeof row.props !== 'object') {
    cd.jira_tickets = {
      props: {
        connected: false,
        baseUrl: null,
        projectKey: null,
        displayName: null,
        issues: [],
        total: 0,
        openCount: 0,
        highCount: 0,
        focused: true,
      } satisfies PanelProps<'jira_tickets'>,
      signal: 0.95,
      evidence: ['Connect Jira to load live tickets'],
    };
    return;
  }
  const props = {
    ...(row.props as PanelProps<'jira_tickets'>),
    focused: true,
  };
  cd.jira_tickets = {
    ...row,
    props,
    signal: Math.max(row.signal, 0.95),
  };
}

/** Center-stage Jira tickets when the user explicitly asked for them. */
function featureJiraTickets(panels: PlannedPanel[]): void {
  const jira = panels.find((p) => p.componentId === 'jira_tickets');
  if (!jira) return;
  jira.zone = 'center';
  jira.size = 'L';
  jira.order = 0;
}
