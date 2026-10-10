import { desc, eq } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import { organizationAuditLog } from '../db/auth-schema';
import { getDrizzle } from '../db/drizzle';

export async function writeAudit(opts: {
  organizationId: string;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  detail?: Record<string, unknown>;
}) {
  const db = getDrizzle();
  if (!db) return;
  await db.insert(organizationAuditLog).values({
    id: `aud_${randomBytes(8).toString('hex')}`,
    organizationId: opts.organizationId,
    actorUserId: opts.actorUserId,
    action: opts.action,
    entityType: opts.entityType,
    entityId: opts.entityId ?? null,
    detail: opts.detail ?? {},
  });
}

export async function listAudit(organizationId: string, limit = 40) {
  const db = getDrizzle();
  if (!db) return [];
  const rows = await db
    .select({
      id: organizationAuditLog.id,
      action: organizationAuditLog.action,
      entityType: organizationAuditLog.entityType,
      entityId: organizationAuditLog.entityId,
      detail: organizationAuditLog.detail,
      actorUserId: organizationAuditLog.actorUserId,
      createdAt: organizationAuditLog.createdAt,
    })
    .from(organizationAuditLog)
    .where(eq(organizationAuditLog.organizationId, organizationId))
    .orderBy(desc(organizationAuditLog.createdAt))
    .limit(Math.min(limit, 100));
  return rows.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
  }));
}
