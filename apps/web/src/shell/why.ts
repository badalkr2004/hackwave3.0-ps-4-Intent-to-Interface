import {
  SIZE_BREAKS,
  type Exclusion,
  type ExclusionReason,
  type Need,
  type Receipt,
  type Size,
} from '@gestalt/shared';

export const EXCLUSION_GROUPS: { reason: ExclusionReason; heading: string }[] = [
  { reason: 'not_relevant', heading: 'Not relevant' },
  { reason: 'low_score', heading: 'Low relevance' },
  { reason: 'no_data', heading: 'No data' },
  { reason: 'no_space', heading: 'No space' },
  { reason: 'dismissed', heading: 'Dismissed' },
];

export const NEED_SOURCE_LABEL: Record<Need['source'], string> = {
  template: 'Template',
  llm_adjusted: 'Adjusted',
  llm_added: 'Added',
  user_pinned: 'Pinned',
};

export function sizeBecause(size: Size): string {
  if (size === 'L') return `Large because score above ${SIZE_BREAKS.L.toFixed(2)}`;
  if (size === 'M') return `Medium because score above ${SIZE_BREAKS.M.toFixed(2)}`;
  return `Small because score below ${SIZE_BREAKS.M.toFixed(2)}`;
}

export function groupedExclusions(excluded: Exclusion[]) {
  return EXCLUSION_GROUPS.map((g) => ({
    ...g,
    items: excluded.filter((e) => e.reason === g.reason),
  })).filter((g) => g.items.length > 0);
}

export function needAdjustment(needs: Need[], type: Receipt['need']): string | undefined {
  const n = needs.find((x) => x.type === type);
  if (!n || (n.source !== 'llm_adjusted' && n.source !== 'llm_added')) return undefined;
  return n.reason;
}

export function confidenceWord(
  interpretations: { id: string; confidence: number }[],
  id: string,
): 'Likely' | 'Possible' {
  const top = Math.max(0, ...interpretations.map((i) => i.confidence));
  return interpretations.find((i) => i.confidence === top)?.id === id ? 'Likely' : 'Possible';
}
