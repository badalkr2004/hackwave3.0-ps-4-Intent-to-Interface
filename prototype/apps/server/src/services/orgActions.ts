import { and, asc, eq, inArray } from 'drizzle-orm';
import { orgActionItem, type MomActionItem } from '../db/auth-schema';
import { getDrizzle } from '../db/drizzle';
import { getDb } from '../db/client';
import { clearDataCache } from './data';
import { writeAudit } from './audit';
import { requireMember } from './orgs';

function dbOrThrow() {
  const db = getDrizzle();
  if (!db) throw new Error('Database is not configured.');
  return db;
}

export async function listActionItems(
  organizationId: string,
  userId: string,
  filter: { status?: 'open' | 'done' | 'missed' | 'all' } = {},
) {
  await requireMember(userId, organizationId);
  const db = dbOrThrow();
  const rows = await db
    .select()
    .from(orgActionItem)
    .where(eq(orgActionItem.organizationId, organizationId))
    .orderBy(asc(orgActionItem.due), asc(orgActionItem.createdAt));

  const today = new Date().toISOString().slice(0, 10);
  const enriched = rows.map((r) => {
    let status = r.status as 'open' | 'done' | 'missed';
    const sla =
      status === 'open' && r.due
        ? r.due < today
          ? 'overdue'
          : r.due === today
            ? 'due_today'
            : 'on_track'
        : status === 'done'
          ? 'done'
          : status === 'missed'
            ? 'missed'
            : 'none';
    return {
      id: r.id,
      organizationId: r.organizationId,
      meetingMinutesId: r.meetingMinutesId,
      clientId: r.clientId,
      text: r.text,
      owner: r.owner,
      due: r.due,
      status,
      sla,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  });

  if (!filter.status || filter.status === 'all') return enriched;
  return enriched.filter((r) => r.status === filter.status);
}

export async function updateActionItem(
  organizationId: string,
  userId: string,
  itemId: string,
  patch: { status?: 'open' | 'done' | 'missed'; owner?: string | null; due?: string | null },
) {
  await requireMember(userId, organizationId);
  const db = dbOrThrow();
  const [row] = await db
    .select()
    .from(orgActionItem)
    .where(and(eq(orgActionItem.id, itemId), eq(orgActionItem.organizationId, organizationId)))
    .limit(1);
  if (!row) throw new Error('Action item not found.');

  const next = {
    status: patch.status ?? row.status,
    owner: patch.owner !== undefined ? patch.owner : row.owner,
    due: patch.due !== undefined ? patch.due : row.due,
    updatedAt: new Date(),
  };

  await db.update(orgActionItem).set(next).where(eq(orgActionItem.id, itemId));

  // Keep meeting_minutes JSONB + story meetings commitments in sync when possible.
  if (row.meetingMinutesId) {
    const { meetingMinutes } = await import('../db/auth-schema');
    const [mom] = await db
      .select()
      .from(meetingMinutes)
      .where(eq(meetingMinutes.id, row.meetingMinutesId))
      .limit(1);
    if (mom) {
      const items = (mom.actionItems as MomActionItem[]).map((a) =>
        a.id === itemId
          ? {
              ...a,
              status: next.status as MomActionItem['status'],
              owner: next.owner,
              due: next.due,
            }
          : a,
      );
      await db
        .update(meetingMinutes)
        .set({ actionItems: items })
        .where(eq(meetingMinutes.id, mom.id));

      if (mom.meetingId) {
        const story = getDb();
        if (story) {
          const commitments = items.map((a) => ({
            id: a.id,
            text: a.text,
            status: a.status,
            due: a.due ?? new Date().toISOString().slice(0, 10),
          }));
          await story.sql`
            UPDATE ${story.table('meetings')}
            SET commitments = ${story.sql.json(commitments)}
            WHERE id = ${mom.meetingId}`;
          clearDataCache();
        }
      }
    }
  }

  await writeAudit({
    organizationId,
    actorUserId: userId,
    action: 'action_item.updated',
    entityType: 'action_item',
    entityId: itemId,
    detail: { status: next.status, owner: next.owner, due: next.due },
  });

  return listActionItems(organizationId, userId).then((all) => all.find((a) => a.id === itemId)!);
}

/** Mark open items past due as missed (nightly-style; also callable from API). */
export async function rollSla(organizationId: string, userId: string) {
  await requireMember(userId, organizationId, 'admin');
  const db = dbOrThrow();
  const today = new Date().toISOString().slice(0, 10);
  const open = await db
    .select()
    .from(orgActionItem)
    .where(
      and(eq(orgActionItem.organizationId, organizationId), eq(orgActionItem.status, 'open')),
    );
  const overdue = open.filter((r) => r.due && r.due < today);
  if (overdue.length === 0) return { updated: 0 };
  await db
    .update(orgActionItem)
    .set({ status: 'missed', updatedAt: new Date() })
    .where(
      and(
        eq(orgActionItem.organizationId, organizationId),
        inArray(
          orgActionItem.id,
          overdue.map((o) => o.id),
        ),
      ),
    );
  await writeAudit({
    organizationId,
    actorUserId: userId,
    action: 'action_item.sla_roll',
    entityType: 'organization',
    entityId: organizationId,
    detail: { updated: overdue.length },
  });
  return { updated: overdue.length };
}
