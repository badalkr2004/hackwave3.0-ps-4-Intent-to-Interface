import { and, desc, eq } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import {
  meetingMinutes,
  orgActionItem,
  organization,
  organizationClient,
  organizationInvite,
  organizationMember,
  userWorkspacePrefs,
  type MomActionItem,
} from '../db/auth-schema';
import { getDrizzle } from '../db/drizzle';
import { getDb } from '../db/client';
import type { AccessRole } from './accessPolicy';
import { writeAudit } from './audit';
import { clearDataCache } from './data';
import { parseMom } from './momParse';

const id = (prefix: string) => `${prefix}_${randomBytes(8).toString('hex')}`;
const inviteCode = () => randomBytes(4).toString('hex').toUpperCase();

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return base || 'org';
}

export type OrgRole = 'owner' | 'admin' | 'member';

export interface OrgSummary {
  id: string;
  name: string;
  slug: string;
  role: OrgRole;
  accessRole: AccessRole;
}

function dbOrThrow() {
  const db = getDrizzle();
  if (!db) throw new Error('Database is not configured.');
  return db;
}

export async function listOrgsForUser(userId: string): Promise<OrgSummary[]> {
  const db = dbOrThrow();
  const rows = await db
    .select({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      role: organizationMember.role,
      accessRole: organizationMember.accessRole,
    })
    .from(organizationMember)
    .innerJoin(organization, eq(organization.id, organizationMember.organizationId))
    .where(eq(organizationMember.userId, userId));
  return rows.map((r) => ({
    ...r,
    role: r.role as OrgRole,
    accessRole: (r.accessRole ?? 'manager') as AccessRole,
  }));
}

export async function getActiveOrgId(userId: string): Promise<string | null> {
  const db = dbOrThrow();
  const [row] = await db
    .select({ activeOrganizationId: userWorkspacePrefs.activeOrganizationId })
    .from(userWorkspacePrefs)
    .where(eq(userWorkspacePrefs.userId, userId))
    .limit(1);
  if (row?.activeOrganizationId) return row.activeOrganizationId;
  const orgs = await listOrgsForUser(userId);
  return orgs[0]?.id ?? null;
}

export async function setActiveOrg(userId: string, organizationId: string | null) {
  const db = dbOrThrow();
  if (organizationId) {
    const membership = await memberRole(userId, organizationId);
    if (!membership) throw new Error('Not a member of that organization.');
  }
  await db
    .insert(userWorkspacePrefs)
    .values({
      userId,
      pinned: [],
      dismissed: [],
      activeOrganizationId: organizationId,
    })
    .onConflictDoUpdate({
      target: userWorkspacePrefs.userId,
      set: { activeOrganizationId: organizationId, updatedAt: new Date() },
    });
}

async function memberRole(userId: string, organizationId: string): Promise<OrgRole | null> {
  const db = dbOrThrow();
  const [row] = await db
    .select({ role: organizationMember.role })
    .from(organizationMember)
    .where(
      and(
        eq(organizationMember.userId, userId),
        eq(organizationMember.organizationId, organizationId),
      ),
    )
    .limit(1);
  return (row?.role as OrgRole | undefined) ?? null;
}

export async function requireMember(userId: string, organizationId: string, min: OrgRole = 'member') {
  const role = await memberRole(userId, organizationId);
  if (!role) throw new Error('Not a member of that organization.');
  const rank = { member: 1, admin: 2, owner: 3 } as const;
  if (rank[role] < rank[min]) throw new Error('Insufficient permission.');
  return role;
}

export async function createOrg(userId: string, name: string): Promise<OrgSummary> {
  const db = dbOrThrow();
  const trimmed = name.trim();
  if (trimmed.length < 2) throw new Error('Organization name is too short.');
  if (trimmed.length > 80) throw new Error('Organization name is too long.');

  const orgId = id('org');
  const slug = `${slugify(trimmed)}-${randomBytes(2).toString('hex')}`;
  await db.insert(organization).values({ id: orgId, name: trimmed, slug });
  await db.insert(organizationMember).values({
    id: id('mem'),
    organizationId: orgId,
    userId,
    role: 'owner',
    accessRole: 'manager',
  });
  // New orgs start with no clients — portfolio is assigned explicitly (seed or admin),
  // never the shared demo set.
  await setActiveOrg(userId, orgId);
  await writeAudit({
    organizationId: orgId,
    actorUserId: userId,
    action: 'org.created',
    entityType: 'organization',
    entityId: orgId,
    detail: { name: trimmed, slug },
  });
  return { id: orgId, name: trimmed, slug, role: 'owner', accessRole: 'manager' };
}

/** Link specific client ids to an organization (idempotent). */
export async function linkClientsToOrg(organizationId: string, clientIds: string[]) {
  if (clientIds.length === 0) return;
  const db = dbOrThrow();
  const existing = await clientIdsForOrg(organizationId);
  const have = new Set(existing);
  const next = clientIds.filter((c) => !have.has(c));
  if (next.length === 0) return;
  await db.insert(organizationClient).values(
    next.map((clientId) => ({
      id: id('oc'),
      organizationId,
      clientId,
    })),
  );
}

export async function createInvite(userId: string, organizationId: string, role: 'admin' | 'member' = 'member') {
  await requireMember(userId, organizationId, 'admin');
  const db = dbOrThrow();
  const code = inviteCode();
  const inviteId = id('inv');
  const expiresAt = new Date(Date.now() + 14 * 86_400_000);
  await db.insert(organizationInvite).values({
    id: inviteId,
    organizationId,
    code,
    role,
    expiresAt,
    createdBy: userId,
  });
  await writeAudit({
    organizationId,
    actorUserId: userId,
    action: 'org.invite_created',
    entityType: 'invite',
    entityId: inviteId,
    detail: { role, code },
  });
  return { id: inviteId, code, expiresAt: expiresAt.toISOString(), role };
}

export async function joinWithCode(userId: string, code: string): Promise<OrgSummary> {
  const db = dbOrThrow();
  const normalized = code.trim().toUpperCase();
  const [inv] = await db
    .select()
    .from(organizationInvite)
    .where(eq(organizationInvite.code, normalized))
    .limit(1);
  if (!inv) throw new Error('Invite code not found.');
  if (inv.expiresAt.getTime() < Date.now()) throw new Error('Invite code has expired.');

  const existing = await memberRole(userId, inv.organizationId);
  if (!existing) {
    await db.insert(organizationMember).values({
      id: id('mem'),
      organizationId: inv.organizationId,
      userId,
      role: inv.role,
      accessRole: 'intern',
    });
  }
  await setActiveOrg(userId, inv.organizationId);
  const [org] = await db
    .select()
    .from(organization)
    .where(eq(organization.id, inv.organizationId))
    .limit(1);
  if (!org) throw new Error('Organization missing.');
  if (!existing) {
    await writeAudit({
      organizationId: inv.organizationId,
      actorUserId: userId,
      action: 'org.member_joined',
      entityType: 'member',
      entityId: userId,
      detail: { role: inv.role, via: 'invite' },
    });
  }
  const accessRole = (await memberAccessRole(userId, inv.organizationId)) ?? 'intern';
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    role: existing ?? (inv.role as OrgRole),
    accessRole,
  };
}

export async function memberAccessRole(
  userId: string,
  organizationId: string,
): Promise<AccessRole | null> {
  const db = dbOrThrow();
  const [row] = await db
    .select({ accessRole: organizationMember.accessRole })
    .from(organizationMember)
    .where(
      and(
        eq(organizationMember.userId, userId),
        eq(organizationMember.organizationId, organizationId),
      ),
    )
    .limit(1);
  return (row?.accessRole as AccessRole | undefined) ?? null;
}

export async function listMembers(organizationId: string, userId: string) {
  await requireMember(userId, organizationId);
  const db = dbOrThrow();
  return db
    .select({
      id: organizationMember.id,
      userId: organizationMember.userId,
      role: organizationMember.role,
      accessRole: organizationMember.accessRole,
      createdAt: organizationMember.createdAt,
    })
    .from(organizationMember)
    .where(eq(organizationMember.organizationId, organizationId));
}

export interface IngestMomInput {
  organizationId: string;
  userId: string;
  clientId: string;
  rawText: string;
  title?: string;
  heldAt?: string;
  source?: string;
}

async function assertOrgClient(organizationId: string, clientId: string) {
  const db = dbOrThrow();
  const [link] = await db
    .select({ id: organizationClient.id })
    .from(organizationClient)
    .where(
      and(
        eq(organizationClient.organizationId, organizationId),
        eq(organizationClient.clientId, clientId),
      ),
    )
    .limit(1);
  if (!link) throw new Error('That client is not in your organization portfolio.');
}

export async function ingestMom(input: IngestMomInput) {
  await requireMember(input.userId, input.organizationId);
  const raw = input.rawText.trim();
  if (raw.length < 40) throw new Error('Paste more of the minutes (at least a few sentences).');
  if (raw.length > 80_000) throw new Error('Minutes are too long (80k character limit).');
  await assertOrgClient(input.organizationId, input.clientId);

  const story = getDb();
  if (!story) throw new Error('Database is not configured.');

  const clients = await story.sql<{ id: string; name: string }[]>`
    SELECT id, name FROM ${story.table('clients')} WHERE id = ${input.clientId} LIMIT 1`;
  if (!clients[0]) throw new Error('Unknown client.');

  const parsed = parseMom(raw, input.title?.trim() || `${clients[0].name} meeting`);
  const heldAt = input.heldAt ? new Date(input.heldAt) : new Date();
  if (Number.isNaN(heldAt.getTime())) throw new Error('Invalid meeting date.');

  const momId = id('mom');
  const meetingId = id('mtg');
  const source = input.source ?? 'paste';
  const actionItems: MomActionItem[] = parsed.actionItems.map((a, i) => ({
    id: `${momId}-${i + 1}`,
    text: a.text,
    owner: a.owner,
    due: a.due,
    status: 'open' as const,
  }));

  const commitments = actionItems.map((a) => ({
    id: a.id,
    text: a.text,
    status: a.status,
    due: a.due ?? heldAt.toISOString().slice(0, 10),
  }));

  const notes = [
    parsed.summary,
    parsed.decisions.length ? `Decisions:\n- ${parsed.decisions.join('\n- ')}` : '',
    parsed.attendees.length ? `Attendees: ${parsed.attendees.join(', ')}` : '',
    raw.slice(0, 6000),
  ]
    .filter(Boolean)
    .join('\n\n');

  await story.sql`
    INSERT INTO ${story.table('meetings')} (id, client_id, date, kind, title, notes, commitments)
    VALUES (
      ${meetingId},
      ${input.clientId},
      ${heldAt},
      ${'mom'},
      ${parsed.title},
      ${notes},
      ${story.sql.json(commitments)}
    )`;

  const db = dbOrThrow();
  await db.insert(meetingMinutes).values({
    id: momId,
    organizationId: input.organizationId,
    clientId: input.clientId,
    meetingId,
    title: parsed.title,
    heldAt,
    rawText: raw,
    summary: parsed.summary,
    decisions: parsed.decisions,
    actionItems,
    attendees: parsed.attendees,
    source,
    createdBy: input.userId,
  });

  if (actionItems.length > 0) {
    await db.insert(orgActionItem).values(
      actionItems.map((a) => ({
        id: a.id,
        organizationId: input.organizationId,
        meetingMinutesId: momId,
        clientId: input.clientId,
        text: a.text,
        owner: a.owner,
        due: a.due,
        status: 'open' as const,
      })),
    );
  }

  clearDataCache();
  await writeAudit({
    organizationId: input.organizationId,
    actorUserId: input.userId,
    action: 'mom.ingested',
    entityType: 'meeting_minutes',
    entityId: momId,
    detail: {
      title: parsed.title,
      clientId: input.clientId,
      source,
      actionItems: actionItems.length,
    },
  });

  // Optional RAG sidecar — never blocks or fails MoM write.
  try {
    const { ragIngestFireAndForget } = await import('./ragClient');
    ragIngestFireAndForget([
      {
        id: `mom:${momId}`,
        title: parsed.title,
        text: raw.slice(0, 12_000),
        source_type: 'mom',
        org_id: input.organizationId,
        client_id: input.clientId,
        date: heldAt.toISOString().slice(0, 10),
        tags: ['meeting', 'mom'],
        access_tier: 'public',
      },
    ]);
  } catch {
    /* isolation: ignore */
  }

  return {
    id: momId,
    meetingId,
    title: parsed.title,
    heldAt: heldAt.toISOString(),
    clientId: input.clientId,
    clientName: clients[0].name,
    summary: parsed.summary,
    decisions: parsed.decisions,
    actionItems,
    attendees: parsed.attendees,
    commitmentsCreated: commitments.length,
    source,
  };
}

export async function listMom(organizationId: string, userId: string, limit = 20) {
  await requireMember(userId, organizationId);
  const db = dbOrThrow();
  const rows = await db
    .select({
      id: meetingMinutes.id,
      title: meetingMinutes.title,
      heldAt: meetingMinutes.heldAt,
      clientId: meetingMinutes.clientId,
      summary: meetingMinutes.summary,
      decisions: meetingMinutes.decisions,
      actionItems: meetingMinutes.actionItems,
      attendees: meetingMinutes.attendees,
      createdAt: meetingMinutes.createdAt,
    })
    .from(meetingMinutes)
    .where(eq(meetingMinutes.organizationId, organizationId))
    .orderBy(desc(meetingMinutes.heldAt))
    .limit(Math.min(limit, 50));
  return rows.map((r) => ({
    ...r,
    heldAt: r.heldAt.toISOString(),
    createdAt: r.createdAt.toISOString(),
  }));
}

/** Client ids linked to an organization (no membership check — caller must authorize). */
export async function clientIdsForOrg(organizationId: string): Promise<string[]> {
  const db = dbOrThrow();
  const links = await db
    .select({ clientId: organizationClient.clientId })
    .from(organizationClient)
    .where(eq(organizationClient.organizationId, organizationId));
  return links.map((l) => l.clientId);
}

export async function listClientsForOrg(organizationId: string, userId: string) {
  await requireMember(userId, organizationId);
  const story = getDb();
  if (!story) return [];

  const ids = await clientIdsForOrg(organizationId);
  if (ids.length === 0) return [];

  return story.sql<{ id: string; name: string; health: number }[]>`
    SELECT id, name, health FROM ${story.table('clients')}
    WHERE id = ANY(${ids})
    ORDER BY name ASC`;
}
