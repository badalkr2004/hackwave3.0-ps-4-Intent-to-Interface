import type { Priority } from '@gestalt/shared';
import { ticketMatchesRole } from '../services/accessPolicy';
import { defineModule, dayOf, effectiveClientIds } from './types';

export default defineModule({
  id: 'open_issues',
  async loader(ctx) {
    const { db } = ctx;
    const { sql } = db;
    const allowed = effectiveClientIds(ctx);
    if (allowed && allowed.length === 0) {
      return { tickets: [], totalOpen: 0, highCount: 0, recentShare: 0 };
    }
    const rows = await sql<
      {
        id: string;
        client_id: string;
        client_name: string;
        title: string;
        priority: Priority;
        age_days: number;
        updated_days: number;
        tags: string[];
      }[]
    >`
      SELECT t.id, t.client_id, c.name AS client_name, t.title, t.priority, t.tags,
        (${dayOf(ctx, 0)}::date - t.created::date)::int AS age_days,
        (${dayOf(ctx, 0)}::date - t.updated::date)::int AS updated_days
      FROM ${db.table('tickets')} t
      JOIN ${db.table('clients')} c ON c.id = t.client_id
      WHERE t.status = 'open'
        ${allowed ? sql`AND t.client_id = ANY(${[...allowed]})` : sql``}
      ORDER BY CASE t.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, t.created`;
    const filtered = rows.filter((r) => ticketMatchesRole(r.tags ?? [], ctx.accessRole));
    const recent = filtered.filter((r) => r.updated_days <= 7).length;
    return {
      tickets: filtered.map((r) => ({
        id: r.id,
        clientId: r.client_id,
        clientName: r.client_name,
        title: r.title,
        priority: r.priority,
        ageDays: r.age_days,
        tags: r.tags,
      })),
      totalOpen: filtered.length,
      highCount: filtered.filter((r) => r.priority === 'high').length,
      recentShare: filtered.length ? recent / filtered.length : 0,
    };
  },
  signal: (p) => (p.totalOpen === 0 ? 0 : 0.6 * (p.highCount / p.totalOpen) + 0.4 * p.recentShare),
  evidence: (p) => {
    const tags = new Map<string, number>();
    for (const t of p.tickets) for (const tag of t.tags) tags.set(tag, (tags.get(tag) ?? 0) + 1);
    const top = [...tags.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    return [
      `${p.totalOpen} open tickets, ${p.highCount} high priority`,
      ...(top && top[1] >= 2 ? [`${top[1]} tickets tagged "${top[0]}"`] : []),
    ];
  },
});
