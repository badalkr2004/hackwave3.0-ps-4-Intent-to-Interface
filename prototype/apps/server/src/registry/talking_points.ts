import { buildDigest } from '../services/digest';
import { ruleTalkingPoints } from '../services/copyFallback';
import { clamp01, defineModule } from './types';

export default defineModule({
  id: 'talking_points',
  // Rule-based points double as the skeleton and the last-resort fallback for the LLM copy.
  async loader(ctx) {
    if (!ctx.scope.clientId) return null;
    return ruleTalkingPoints(await buildDigest(ctx));
  },
  async signal(_props, ctx) {
    const [comms, recap] = await Promise.all([
      ctx.load('comms_timeline'),
      ctx.load('last_meeting_recap'),
    ]);
    const negativity = Math.max(0, -(comms?.recentSentiment ?? 0));
    const commitments = recap?.commitments ?? [];
    const unresolved = commitments.length
      ? commitments.filter((c) => c.status === 'missed').length / commitments.length
      : 0;
    return clamp01(0.5 + 0.5 * Math.max(negativity, unresolved));
  },
  evidence: (p) => {
    const counts = p.points.reduce<Record<string, number>>((acc, x) => {
      acc[x.type] = (acc[x.type] ?? 0) + 1;
      return acc;
    }, {});
    return [
      `${p.points.length} points: ${Object.entries(counts)
        .map(([type, n]) => `${n} ${type}`)
        .join(', ')}`,
    ];
  },
});
