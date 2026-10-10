import { buildDigest } from '../services/digest';
import { ruleHypotheses } from '../services/copyFallback';
import { clamp01, defineModule } from './types';

export default defineModule({
  id: 'hypothesis_list',
  // Rule-based hypotheses double as the skeleton and the last-resort fallback for the LLM copy.
  async loader(ctx) {
    if (!ctx.scope.clientId) return null;
    return ruleHypotheses(await buildDigest(ctx));
  },
  async signal(_props, ctx) {
    const usage = await ctx.load('usage_trend');
    return clamp01(Math.abs(usage?.changePct ?? 0) / 40);
  },
  evidence: (p) => {
    const top = p.hypotheses[0];
    return top ? [`Leading explanation: ${top.title.toLowerCase()}`] : [];
  },
});
