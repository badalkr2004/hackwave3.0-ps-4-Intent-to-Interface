import { z } from 'zod';
import { CommitmentStatus } from '@gestalt/shared';
import { defineModule } from './types';

const Commitments = z.array(
  z.object({ id: z.string(), text: z.string(), status: CommitmentStatus, due: z.string() }),
);

export default defineModule({
  id: 'last_meeting_recap',
  async loader(ctx) {
    const clientId = ctx.scope.clientId;
    if (!clientId) return null;
    if (ctx.allowedClientIds && !ctx.allowedClientIds.includes(clientId)) return null;
    const { db } = ctx;
    const rows = await db.sql<
      { id: string; title: string; date: Date; notes: string | null; commitments: unknown }[]
    >`
      SELECT id, title, date, notes, commitments
      FROM ${db.table('meetings')}
      WHERE client_id = ${clientId} AND date < now()
      ORDER BY date DESC
      LIMIT 1`;
    const r = rows[0];
    if (!r) return null;
    return {
      meeting: {
        id: r.id,
        title: r.title,
        date: r.date.toISOString(),
        daysAgo: Math.round((ctx.today.getTime() - r.date.getTime()) / 86_400_000),
        notes: r.notes,
      },
      commitments: Commitments.catch([]).parse(r.commitments),
    };
  },
  signal: (p) =>
    p.commitments.length
      ? p.commitments.filter((c) => c.status !== 'done').length / p.commitments.length
      : 0,
  evidence: (p) => {
    const missed = p.commitments.filter((c) => c.status === 'missed');
    const open = p.commitments.filter((c) => c.status === 'open');
    return [
      `${missed.length} missed and ${open.length} open commitments from ${p.meeting.title}`,
      ...(missed[0] ? [`Missed: ${missed[0].text}`] : []),
    ];
  },
});
