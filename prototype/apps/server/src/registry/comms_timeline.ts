import { defineModule, dayOf } from './types';

export default defineModule({
  id: 'comms_timeline',
  async loader(ctx) {
    const clientId = ctx.scope.clientId;
    if (!clientId) return null;
    if (ctx.allowedClientIds && !ctx.allowedClientIds.includes(clientId)) return null;
    const { db } = ctx;
    const rows = await db.sql<
      {
        id: string;
        channel: 'email' | 'slack';
        date: Date;
        direction: 'inbound' | 'outbound';
        sender: string;
        subject: string | null;
        snippet: string;
        sentiment: number;
      }[]
    >`
      SELECT id, channel, date, direction, sender, subject, snippet, sentiment
      FROM ${db.table('communications')}
      WHERE client_id = ${clientId} AND date >= ${dayOf(ctx, -30)}::date
      ORDER BY date DESC
      LIMIT 8`;
    if (rows.length === 0) return null;
    const recent = rows.slice(0, 3);
    return {
      items: rows.map((r) => ({
        id: r.id,
        channel: r.channel,
        date: r.date.toISOString(),
        daysAgo: Math.max(0, Math.ceil((ctx.today.getTime() - r.date.getTime()) / 86_400_000)),
        direction: r.direction,
        sender: r.sender,
        subject: r.subject,
        snippet: r.snippet,
        sentiment: r.sentiment,
      })),
      recentSentiment:
        Math.round((recent.reduce((s, r) => s + r.sentiment, 0) / recent.length) * 100) / 100,
    };
  },
  signal: (p) => Math.max(0, -(p.recentSentiment ?? 0)),
  evidence: (p) => {
    const latest = p.items[0];
    const tone =
      (p.recentSentiment ?? 0) <= -0.15
        ? 'negative'
        : (p.recentSentiment ?? 0) >= 0.15
          ? 'positive'
          : 'neutral';
    return [
      `Recent sentiment is ${tone} (${(p.recentSentiment ?? 0).toFixed(2)})`,
      ...(latest
        ? [
            `Latest from ${latest.sender}: "${latest.snippet.slice(0, 70)}${latest.snippet.length > 70 ? '…' : ''}"`,
          ]
        : []),
    ];
  },
});
