import { correlatedRelease, daysBetween, loadReleases, loadUsageAnalysis } from './usage';
import { defineModule, dayOf } from './types';

export default defineModule({
  id: 'release_strip',
  async loader(ctx) {
    const [releases, analysis] = await Promise.all([loadReleases(ctx), loadUsageAnalysis(ctx)]);
    const windowStart = dayOf(ctx, -90);
    const inWindow = releases.filter((r) => r.date >= windowStart);
    if (inWindow.length === 0) return null;
    const today = dayOf(ctx, 0);
    const anomalyStart = analysis?.anomalyStart ?? null;
    return {
      releases: inWindow.map((r) => ({
        id: r.id,
        version: r.version,
        date: r.date,
        daysAgo: daysBetween(r.date, ctx.today),
        notes: r.notes,
        features: r.features,
        released: r.date <= today,
      })),
      anomalyStart,
      correlatedReleaseId: correlatedRelease(inWindow, anomalyStart)?.id ?? null,
    };
  },
  signal: (p) => (p.correlatedReleaseId ? 1 : 0.3),
  evidence: (p) => {
    const rel = p.releases.find((r) => r.id === p.correlatedReleaseId);
    if (!rel) return ['No release lines up with the change'];
    return [
      `${rel.version} shipped right before the drop started`,
      ...(rel.features.length ? [`${rel.version} touched ${rel.features.join(' and ')}`] : []),
    ];
  },
});
