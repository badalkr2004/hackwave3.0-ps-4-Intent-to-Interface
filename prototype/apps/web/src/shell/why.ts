import {
  type Exclusion,
  type ExclusionReason,
  type Need,
  type Receipt,
  type Size,
} from '@gestalt/shared';

/** Plain-language group titles for people who do not care about auction jargon. */
export const EXCLUSION_GROUPS: { reason: ExclusionReason; heading: string }[] = [
  { reason: 'role_access', heading: 'Hidden for your access role' },
  { reason: 'not_relevant', heading: 'Not needed for this job' },
  { reason: 'low_score', heading: 'Less useful right now' },
  { reason: 'no_data', heading: 'No facts available' },
  { reason: 'no_space', heading: 'Did not fit on screen' },
  { reason: 'dismissed', heading: 'You hid these' },
];

export const NEED_SOURCE_LABEL: Record<Need['source'], string> = {
  template: 'Usual for this job',
  llm_adjusted: 'Raised for this case',
  llm_added: 'Added for this case',
  user_pinned: 'You kept this',
};

export function sizeBecause(size: Size): string {
  if (size === 'L') return 'Shown large because it is central';
  if (size === 'M') return 'Shown medium for context';
  return 'Shown small as supporting detail';
}

export function sizeWord(size: Size): 'Large' | 'Medium' | 'Small' {
  if (size === 'L') return 'Large';
  if (size === 'M') return 'Medium';
  return 'Small';
}

/** Compact score + size for Why strip / popover. */
export function scoreLine(score: number, size: Size): string {
  return `Score ${score.toFixed(2)} · ${sizeWord(size)}`;
}

export function fitLabel(score: number): string {
  if (score >= 0.8) return 'Very useful here';
  if (score >= 0.5) return 'Useful here';
  return 'Supporting detail';
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
): 'Best match' | 'Also possible' {
  const top = Math.max(0, ...interpretations.map((i) => i.confidence));
  return interpretations.find((i) => i.confidence === top)?.id === id
    ? 'Best match'
    : 'Also possible';
}
