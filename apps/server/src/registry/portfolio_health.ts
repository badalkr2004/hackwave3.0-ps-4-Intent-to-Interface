import { loadClients, loadUsageAnalyses } from './usage';
import { defineModule, dayOf } from './types';

export default defineModule({
  id: 'portfolio_health',
  async loader(ctx) {
    const { db } = ctx;
    const [rows, usage] = await Promise.all([
      db.sql<{ id: string; renewal_in_days: number | null }[]>`
        SELECT id, (renewal_date - ${dayOf(ctx, 0)}::date)::int AS renewal_in_days
        FROM ${db.table('clients')}`,
      loadUsageAnalyses(ctx),
    ]);
    const clients = await loadClients(ctx);
    if (clients.length === 0) return null;
    const renewals = new Map(rows.map((r) => [r.id, r.renewal_in_days]));
    return {
      clients: clients.map((c) => ({
        id: c.id,
        name: c.name,
        plan: c.plan,
        arr: c.arr,
        health: c.health,
        usageChangePct: usage.byClient.has(c.id)
          ? Math.round(usage.byClient.get(c.id)!.changePct)
          : null,
        renewalInDays: renewals.get(c.id) ?? null,
      })),
      totalArr: clients.reduce((s, c) => s + c.arr, 0),
      atRiskCount: clients.filter((c) => c.health < 60).length,
    };
  },
  signal: (p) => (p.clients.length ? p.atRiskCount / p.clients.length : 0),
  evidence: (p) => {
    const worst = [...p.clients].sort((a, b) => a.health - b.health)[0];
    return [
      `${p.atRiskCount} of ${p.clients.length} clients have health under 60`,
      ...(worst ? [`${worst.name} is lowest at ${worst.health}`] : []),
    ];
  },
});
