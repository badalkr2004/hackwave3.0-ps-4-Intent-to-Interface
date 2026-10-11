import { createHash, randomBytes } from 'node:crypto';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { mcpAccessToken, user } from '../db/auth-schema';
import { getDrizzle } from '../db/drizzle';
import { getActiveOrgId, requireMember } from './orgs';

const DEFAULT_SCOPES = ['org:read', 'org:write', 'jira', 'google'] as const;

function dbOrThrow() {
  const db = getDrizzle();
  if (!db) throw new Error('Database is not configured.');
  return db;
}

function id() {
  return `mcpt_${randomBytes(10).toString('hex')}`;
}

export function hashMcpToken(plaintext: string): string {
  return createHash('sha256').update(plaintext).digest('hex');
}

/** Issue a new PAT bound to the user's active organization. Plaintext returned once. */
export async function issueMcpToken(
  userId: string,
  opts: { name?: string; expiresInDays?: number | null } = {},
) {
  const organizationId = await getActiveOrgId(userId);
  if (!organizationId) {
    throw new Error('Select an active organization before connecting an IDE.');
  }
  await requireMember(userId, organizationId);

  const plaintext = `gst_mcp_${randomBytes(24).toString('base64url')}`;
  const tokenHash = hashMcpToken(plaintext);
  const tokenPrefix = plaintext.slice(0, 16);
  const expiresAt =
    opts.expiresInDays && opts.expiresInDays > 0
      ? new Date(Date.now() + opts.expiresInDays * 86_400_000)
      : null;

  const db = dbOrThrow();
  const rowId = id();
  const [row] = await db
    .insert(mcpAccessToken)
    .values({
      id: rowId,
      userId,
      organizationId,
      name: (opts.name?.trim() || 'IDE').slice(0, 64),
      tokenPrefix,
      tokenHash,
      scopes: [...DEFAULT_SCOPES],
      expiresAt,
    })
    .returning();

  if (!row) throw new Error('Could not create MCP token.');

  return {
    token: plaintext,
    meta: toPublicToken(row),
  };
}

export async function listMcpTokens(userId: string) {
  const db = dbOrThrow();
  const rows = await db
    .select()
    .from(mcpAccessToken)
    .where(eq(mcpAccessToken.userId, userId))
    .orderBy(desc(mcpAccessToken.createdAt))
    .limit(50);
  return rows.map(toPublicToken);
}

export async function revokeMcpToken(userId: string, tokenId: string) {
  const db = dbOrThrow();
  const [row] = await db
    .update(mcpAccessToken)
    .set({ revokedAt: new Date() })
    .where(and(eq(mcpAccessToken.id, tokenId), eq(mcpAccessToken.userId, userId)))
    .returning();
  if (!row) throw new Error('Token not found.');
  return toPublicToken(row);
}

export type McpTokenActor = {
  tokenId: string;
  userId: string;
  organizationId: string;
  scopes: string[];
  email: string;
  name: string;
};

/** Validate plaintext PAT and return the acting user + org (org fixed at issue time). */
export async function resolveMcpTokenActor(plaintext: string): Promise<McpTokenActor> {
  const token = plaintext.trim();
  if (!token.startsWith('gst_mcp_') || token.length < 24) {
    throw new Error('Invalid MCP token. Create a new one from Gestalt → Connectors → IDE access.');
  }

  const db = dbOrThrow();
  const tokenHash = hashMcpToken(token);
  const [row] = await db
    .select()
    .from(mcpAccessToken)
    .where(and(eq(mcpAccessToken.tokenHash, tokenHash), isNull(mcpAccessToken.revokedAt)))
    .limit(1);

  if (!row) {
    throw new Error('MCP token not found or revoked. Create a new one from Connectors → IDE access.');
  }
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) {
    throw new Error('MCP token expired. Create a new one from Connectors → IDE access.');
  }

  await requireMember(row.userId, row.organizationId);

  const [u] = await db
    .select({ id: user.id, email: user.email, name: user.name })
    .from(user)
    .where(eq(user.id, row.userId))
    .limit(1);
  if (!u) throw new Error('MCP token user no longer exists.');

  await db
    .update(mcpAccessToken)
    .set({ lastUsedAt: new Date() })
    .where(eq(mcpAccessToken.id, row.id));

  return {
    tokenId: row.id,
    userId: row.userId,
    organizationId: row.organizationId,
    scopes: row.scopes ?? [...DEFAULT_SCOPES],
    email: u.email,
    name: u.name,
  };
}

function toPublicToken(row: typeof mcpAccessToken.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    tokenPrefix: row.tokenPrefix,
    organizationId: row.organizationId,
    scopes: row.scopes,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    revokedAt: row.revokedAt?.toISOString() ?? null,
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    active: !row.revokedAt && (!row.expiresAt || row.expiresAt.getTime() > Date.now()),
  };
}

export type PublicMcpToken = ReturnType<typeof toPublicToken>;
