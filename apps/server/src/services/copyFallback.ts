import type { EvidenceRef, PanelProps } from '@gestalt/shared';
import type { Digest } from './digest';

type Hypothesis = PanelProps<'hypothesis_list'>['hypotheses'][number];
type TalkingPoint = PanelProps<'talking_points'>['points'][number];

const abs = (n: number) => Math.abs(Math.round(n));
const quote = (s: string, max = 80) => {
  const text = s.replace(/[.!?]+$/, '');
  return `"${text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text}"`;
};

function longDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

/** Human-readable label for a digest id, used by evidence chips. */
export function evidenceLabel(d: Digest, id: string): string | null {
  if (d.scope.client?.id === id) return d.scope.client.name;
  if (d.usage?.id === id)
    return `Usage ${d.usage.changePct < 0 ? '−' : '+'}${abs(d.usage.changePct)}%`;
  const seg = d.usage?.worstSegments.find((s) => s.id === id);
  if (seg) return `${seg.label} −${abs(seg.deltaPct)}%`;
  const rel = d.releases.find((r) => r.id === id);
  if (rel) return `Release ${rel.version}`;
  const ticket = d.tickets.find((t) => t.id === id);
  if (ticket) return `${id.replace('ticket:', '')} ${ticket.title}`;
  const comm = d.comms.find((c) => c.id === id);
  if (comm) return `${comm.sender}, ${comm.daysAgo}d ago`;
  const commitment = d.commitments.find((c) => c.id === id);
  if (commitment) return commitment.text;
  const task = [...d.work.overdue, ...d.work.blockedBy].find((t) => t.id === id);
  if (task) return task.title;
  if (d.meeting?.id === id) return d.meeting.title;
  return null;
}

/** Resolves ids to evidence chips, dropping any id the digest does not contain. */
export function evidenceRefs(d: Digest, ids: (string | null | undefined)[]): EvidenceRef[] {
  const out: EvidenceRef[] = [];
  for (const id of ids) {
    if (!id || out.some((e) => e.id === id)) continue;
    const label = evidenceLabel(d, id);
    if (label) out.push({ id, label });
  }
  return out;
}

export function ruleHypotheses(d: Digest): PanelProps<'hypothesis_list'> | null {
  const usage = d.usage;
  if (!usage || usage.changePct > -10) return null;
  const hypotheses: Hypothesis[] = [];
  const feature = usage.worstSegments.find((s) => s.dimension === 'feature');
  const team = usage.worstSegments.find((s) => s.dimension === 'team');
  const release = d.releases.find((r) => r.correlated);

  if (release) {
    const touched =
      feature && release.features.includes(feature.label.toLowerCase()) ? feature : null;
    const featureName =
      (touched ?? feature)?.label.toLowerCase() ?? release.features[0] ?? 'the product';
    const related = d.tickets.filter(
      (t) => t.tags.includes(featureName) || t.tags.includes(release.version),
    );
    hypotheses.push({
      title: `Release ${release.version} broke ${featureName}`,
      confidence: touched && related.length >= 2 ? 'high' : 'medium',
      explanation:
        `Usage started falling right after ${release.version} shipped ${release.daysAgo} days ago` +
        (touched ? `, and ${featureName} is down ${abs(touched.deltaPct)}%` : '') +
        (related.length ? `. ${related.length} open tickets mention it.` : '.'),
      evidence: evidenceRefs(d, [release.id, touched?.id, ...related.slice(0, 2).map((t) => t.id)]),
      howToConfirm: `Compare ${featureName} errors and timeouts before and after ${release.version}.`,
    });
  }

  if (team) {
    const negative = [...d.comms]
      .filter((c) => c.sentiment < 0)
      .sort((a, b) => a.sentiment - b.sentiment)[0];
    const who = d.scope.client?.contactName ?? 'the main contact';
    hypotheses.push({
      title: `The ${team.label.toLowerCase()} team is working around the product`,
      confidence: 'medium',
      explanation:
        `${team.label} usage is down ${abs(team.deltaPct)}%, more than the account overall` +
        (negative ? `, and ${negative.sender} wrote ${quote(negative.snippet, 70)}` : '') +
        '.',
      evidence: evidenceRefs(d, [team.id, negative?.id]),
      howToConfirm: `Ask ${who} how the ${team.label.toLowerCase()} team is doing that work today.`,
    });
  }

  const billing = d.tickets.find((t) => t.tags.includes('billing'));
  hypotheses.push(
    billing
      ? {
          title: 'Seat changes reduced activity',
          confidence: 'low',
          explanation: `A billing ticket questions the seat count, so fewer active users could explain part of the drop.`,
          evidence: evidenceRefs(d, [billing.id, usage.id]),
          howToConfirm: 'Compare active seats this month with the last invoice.',
        }
      : {
          title: 'A seasonal slowdown',
          confidence: 'low',
          explanation: `Usage is down ${abs(usage.changePct)}%; a quiet period at the client could explain part of it.`,
          evidence: evidenceRefs(d, [usage.id]),
          howToConfirm: 'Compare with the same weeks last year.',
        },
  );

  if (hypotheses.length < 2) {
    hypotheses.unshift({
      title: 'A workflow change at the client',
      confidence: 'medium',
      explanation: `Usage is down ${abs(usage.changePct)}% with no release lining up with the change.`,
      evidence: evidenceRefs(d, [usage.id]),
      howToConfirm: 'Ask the client whether a team changed tools or processes recently.',
    });
  }
  return {
    hypotheses: hypotheses.filter((h) => h.evidence.length > 0).slice(0, 4),
    generatedWithoutAi: true,
  };
}

export function ruleTalkingPoints(d: Digest): PanelProps<'talking_points'> | null {
  if (!d.scope.client) return null;
  const points: TalkingPoint[] = [];
  const high = d.tickets.filter((t) => t.priority === 'high');
  const worstComm = [...d.comms]
    .filter((c) => c.direction === 'inbound' && c.sentiment < 0)
    .sort((a, b) => a.sentiment - b.sentiment)[0];

  if (high.length || worstComm) {
    const lead = high[0];
    points.push({
      type: 'acknowledge',
      headline: lead
        ? `Acknowledge the issue: ${lead.title}`
        : 'Acknowledge their recent frustration',
      detail:
        (high.length ? `${high.length} high-priority tickets are open. ` : '') +
        (worstComm ? `${worstComm.sender} wrote ${quote(worstComm.snippet)}.` : ''),
      evidence: evidenceRefs(d, [...high.slice(0, 2).map((t) => t.id), worstComm?.id]),
    });
  }

  for (const c of d.commitments.filter((c) => c.status === 'missed').slice(0, 1)) {
    points.push({
      type: 'commit',
      headline: `Give a new date for the missed promise`,
      detail: `"${c.text}" was promised at the last meeting and missed. Offer a date you can keep.`,
      evidence: evidenceRefs(d, [c.id, d.work.overdue[0]?.id]),
    });
  }
  for (const c of d.commitments.filter((c) => c.status === 'open').slice(0, 1)) {
    points.push({
      type: 'commit',
      headline: `Confirm the open promise: ${c.text}`,
      detail: `Still open from the last meeting, due ${longDate(c.due)}.`,
      evidence: evidenceRefs(d, [c.id]),
    });
  }

  const team = d.usage?.worstSegments.find((s) => s.dimension === 'team');
  if (team) {
    points.push({
      type: 'ask',
      headline: `Ask how the ${team.label.toLowerCase()} team is coping`,
      detail: `Their usage is down ${abs(team.deltaPct)}%. Learn what they need most right now.`,
      evidence: evidenceRefs(d, [team.id]),
    });
  }

  if (d.usage && d.usage.changePct <= -10) {
    const renewal = d.scope.client.renewalInDays;
    points.push({
      type: 'risk',
      headline: `Usage is down ${abs(d.usage.changePct)}%${renewal !== null ? ` with renewal in ${renewal} days` : ''}`,
      detail: `Health is ${d.scope.client.health}. Treat the fix timeline as a renewal risk.`,
      evidence: evidenceRefs(d, [d.usage.id, d.scope.client.id]),
    });
  }

  const valid = points.filter((p) => p.evidence.length > 0).slice(0, 6);
  return valid.length ? { points: valid, generatedWithoutAi: true } : null;
}
