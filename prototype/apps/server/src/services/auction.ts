import {
  SCORE_THRESHOLD,
  Zone,
  templateNeeds,
  type ComponentManifest,
  type Exclusion,
  type GhostLayout,
  type Need,
  type NeedType,
  type Receipt,
  type Shape,
  type Size,
} from '@gestalt/shared';
import { clampSize, packZone, sizeForScore, type PackCandidate } from './layout';

export interface ComponentData {
  props: unknown | null;
  signal: number;
  evidence: string[];
}

export interface AuctionInput {
  shape: Shape;
  needs: readonly Need[];
  manifests: readonly ComponentManifest[];
  data: Readonly<Record<string, ComponentData>>;
  pinned: ReadonlySet<string>;
  dismissed: ReadonlySet<string>;
}

export interface PlannedPanel {
  componentId: string;
  need: NeedType;
  question: string;
  alsoServes: NeedType[];
  priority: number;
  fit: number;
  signal: number;
  score: number;
  size: Size;
  zone: Zone;
  order: number;
  pinned: boolean;
  evidence: string[];
}

export interface AuctionResult {
  panels: PlannedPanel[];
  receipts: Receipt[];
  excluded: Exclusion[];
}

interface Candidate extends PackCandidate {
  manifest: ComponentManifest;
  need: Need;
  fit: number;
  signal: number;
  alsoServes: NeedType[];
  evidence: string[];
}

const round = (n: number) => Math.round(n * 1000) / 1000;
const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

function receiptReason(need: Need, evidence: readonly string[]): string {
  const base = `Answers '${need.question}' (priority ${need.priority.toFixed(2)}).`;
  const first = evidence[0]?.trim().replace(/\.$/, '');
  return first ? `${base} ${first}.` : base;
}

/** Deterministic component auction + layout grammar (Section 8). Pure: no I/O, clock, or randomness. */
export function runAuction(input: AuctionInput): AuctionResult {
  const { shape, needs, manifests, data, pinned, dismissed } = input;
  const excluded: Exclusion[] = [];
  const candidates: Candidate[] = [];

  for (const m of manifests) {
    const exclude = (reason: Exclusion['reason'], detail: string, score?: number) =>
      excluded.push({
        componentId: m.id,
        title: m.title,
        reason,
        detail,
        ...(score === undefined ? {} : { score: round(score) }),
      });

    if (dismissed.has(m.id)) {
      exclude('dismissed', 'You dismissed this panel.');
      continue;
    }

    const signal = clamp01(data[m.id]?.signal ?? 0);
    const matches = m.answers.flatMap((a) =>
      needs
        .filter((n) => n.type === a.need)
        .map((n) => ({ need: n, fit: a.fit, score: n.priority * a.fit * (0.7 + 0.3 * signal) })),
    );
    if (matches.length === 0) {
      exclude('not_relevant', 'Does not help with this job.');
      continue;
    }

    const best = matches.reduce((a, b) => (b.score > a.score ? b : a));
    const d = data[m.id];
    if (!d || d.props === null || d.props === undefined) {
      exclude('no_data', 'No facts available for what you selected.', best.score);
      continue;
    }

    const isPinned = pinned.has(m.id);
    if (best.score < SCORE_THRESHOLD && !isPinned) {
      exclude('low_score', 'Other items help more right now.', best.score);
      continue;
    }

    const placement = m.placement[shape];
    candidates.push({
      componentId: m.id,
      manifest: m,
      zone: placement.zone,
      order: placement.order,
      score: best.score,
      pinned: isPinned,
      desiredSize: clampSize(sizeForScore(best.score), m.sizes),
      sizes: m.sizes,
      need: best.need,
      fit: best.fit,
      signal,
      alsoServes: [...new Set(matches.filter((x) => x !== best).map((x) => x.need.type))].filter(
        (t) => t !== best.need.type,
      ),
      evidence: d.evidence.slice(0, 3),
    });
  }

  const panels: PlannedPanel[] = [];
  const receipts: Receipt[] = [];

  for (const zone of Zone.options) {
    const { placed, overflow } = packZone(
      zone,
      candidates.filter((c) => c.zone === zone),
    );
    for (const { candidate: c, size } of placed) {
      panels.push({
        componentId: c.componentId,
        need: c.need.type,
        question: c.manifest.question,
        alsoServes: c.alsoServes,
        priority: c.need.priority,
        fit: c.fit,
        signal: round(c.signal),
        score: round(c.score),
        size,
        zone,
        order: c.order,
        pinned: c.pinned,
        evidence: c.evidence,
      });
      receipts.push({
        panelId: c.componentId,
        componentId: c.componentId,
        need: c.need.type,
        alsoServes: c.alsoServes,
        priority: c.need.priority,
        fit: c.fit,
        signal: round(c.signal),
        score: round(c.score),
        size,
        evidence: c.evidence,
        reason: receiptReason(c.need, c.evidence),
      });
    }
    for (const c of overflow) {
      excluded.push({
        componentId: c.componentId,
        title: c.manifest.title,
        reason: 'no_space',
        detail: 'Did not fit on screen without crowding the view.',
        score: round(c.score),
      });
    }
  }

  const manifestIndex = new Map(manifests.map((m, i) => [m.id, i]));
  excluded.sort((a, b) => manifestIndex.get(a.componentId)! - manifestIndex.get(b.componentId)!);

  return { panels, receipts, excluded };
}

/** Template-only preview of a shape: template needs, all data present, signal 0.5. No LLM, no DB. */
export function ghostLayout(shape: Shape, manifests: readonly ComponentManifest[]): GhostLayout {
  const data = Object.fromEntries(
    manifests.map((m) => [m.id, { props: {}, signal: 0.5, evidence: [] } satisfies ComponentData]),
  );
  const { panels } = runAuction({
    shape,
    needs: templateNeeds(shape),
    manifests,
    data,
    pinned: new Set(),
    dismissed: new Set(),
  });
  const slot = (zone: Zone) =>
    panels
      .filter((p) => p.zone === zone)
      .map((p) => ({ componentId: p.componentId, size: p.size }));
  return { left: slot('left'), center: slot('center'), right: slot('right') };
}
