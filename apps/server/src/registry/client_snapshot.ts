import { loadUsageAnalyses } from './usage';
import { defineModule, dayOf, effectiveClientIds, pctText } from './types';

export default defineModule({
  id: 'client_snapshot',
  // With no client in scope, the snapshot shows the most at-risk client in the org.
  async loader(ctx) {
    const { db } = ctx;
    const { sql } = db;
    const allowed = effectiveClientIds(ctx);
    if (allowed && allowed.length === 0) return null;
    const [rows, usage] = await Promise.all([
      sql<
        {
          id: string;
          name: string;
          plan: string;
          arr: number;
          health: number;
          renewal_in_days: number | null;
          contact_name: string | null;
          contact_title: string | null;
          csm_name: string | null;
          open_tickets: number;
          high_tickets: number;
          recent_sentiment: number | null;
        }[]
      >`
        SELECT c.id, c.name, c.plan, c.arr, c.health,
          (c.renewal_date - ${dayOf(ctx, 0)}::date)::int AS renewal_in_days,
          c.contact_name, c.contact_title, p.name AS csm_name,
          (SELECT count(*) FROM ${db.table('tickets')} t
            WHERE t.client_id = c.id AND t.status = 'open')::int AS open_tickets,
          (SELECT count(*) FROM ${db.table('tickets')} t
            WHERE t.client_id = c.id AND t.status = 'open' AND t.priority = 'high')::int AS high_tickets,
          (SELECT avg(s.sentiment) FROM (
            SELECT sentiment FROM ${db.table('communications')} m
            WHERE m.client_id = c.id ORDER BY m.date DESC LIMIT 3) s)::float8 AS recent_sentiment
        FROM ${db.table('clients')} c
        LEFT JOIN ${db.table('people')} p ON p.id = c.csm_id
        WHERE ${allowed ? sql`c.id = ANY(${[...allowed]})` : sql`true`}
        ORDER BY c.health, c.id
        LIMIT 1`,
      loadUsageAnalyses(ctx),
    ]);
    const r = rows[0];
    if (!r) return null;
    const u = usage.byClient.get(r.id);
    return {
      client: {
        id: r.id,
        name: r.name,
        plan: r.plan,
        arr: r.arr,
        health: r.health,
        renewalInDays: r.renewal_in_days,
        contactName: r.contact_name,
        contactTitle: r.contact_title,
        csmName: r.csm_name,
      },
      openTickets: r.open_tickets,
      highPriorityTickets: r.high_tickets,
      usageChangePct: u ? Math.round(u.changePct) : null,
      recentSentiment:
        r.recent_sentiment === null ? null : Math.round(r.recent_sentiment * 100) / 100,
    };
  },
  signal: (p) => 1 - p.client.health / 100,
  evidence: (p) => [
    `Health ${p.client.health}${p.client.renewalInDays !== null ? `, renewal in ${p.client.renewalInDays} days` : ''}`,
    ...(p.usageChangePct !== null && Math.abs(p.usageChangePct) >= 10
      ? [`Usage ${pctText(p.usageChangePct)}`]
      : []),
  ],
});
