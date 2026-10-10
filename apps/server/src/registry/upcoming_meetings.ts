import { defineModule } from './types';

export default defineModule({
  id: 'upcoming_meetings',
  async loader(ctx) {
    const { db } = ctx;
    const { sql } = db;
    const clientId = ctx.scope.clientId;
    const rows = await sql<
      {
        id: string;
        client_id: string;
        client_name: string;
        title: string;
        kind: string;
        starts_at: Date;
      }[]
    >`
      SELECT m.id, m.client_id, c.name AS client_name, m.title, m.kind, m.date AS starts_at
      FROM ${db.table('meetings')} m
      JOIN ${db.table('clients')} c ON c.id = m.client_id
      WHERE m.date >= now() AND m.date < now() + interval '7 days'
        ${clientId ? sql`AND m.client_id = ${clientId}` : sql``}
      ORDER BY m.date
      LIMIT 6`;
    if (rows.length === 0) return null;
    const now = Date.now();
    return {
      meetings: rows.map((r) => ({
        id: r.id,
        clientId: r.client_id,
        clientName: r.client_name,
        title: r.title,
        kind: r.kind,
        startsAt: r.starts_at.toISOString(),
        inHours: Math.round(((r.starts_at.getTime() - now) / 3_600_000) * 10) / 10,
      })),
    };
  },
  signal: (p) => (p.meetings.some((m) => m.inHours >= 0 && m.inHours <= 48) ? 1 : 0.4),
  evidence: (p) => {
    const next = p.meetings[0];
    if (!next) return [];
    const when =
      next.inHours <= 48 ? 'within 48 hours' : `in ${Math.round(next.inHours / 24)} days`;
    return [`${next.title} with ${next.clientName} ${when}`];
  },
});
