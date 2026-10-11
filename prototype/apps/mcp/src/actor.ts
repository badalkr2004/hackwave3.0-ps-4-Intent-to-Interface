import { resolveMcpTokenActor } from '../../server/src/services/mcpTokens';
import { loadMcpEnv } from './env';

export type McpActor = {
  userId: string;
  email: string;
  name: string;
  organizationId: string;
  tokenId: string;
  scopes: string[];
};

let cached: McpActor | null = null;
let cachedToken: string | null = null;

/** Resolve acting user + org from the MCP personal access token. */
export async function resolveActor(): Promise<McpActor> {
  const { GESTALT_MCP_TOKEN: token } = loadMcpEnv();
  if (cached && cachedToken === token) return cached;

  const actor = await resolveMcpTokenActor(token);
  cached = {
    userId: actor.userId,
    email: actor.email,
    name: actor.name,
    organizationId: actor.organizationId,
    tokenId: actor.tokenId,
    scopes: actor.scopes,
  };
  cachedToken = token;
  return cached;
}

export async function actorSummary() {
  const actor = await resolveActor();
  return {
    user: { id: actor.userId, email: actor.email, name: actor.name },
    activeOrganizationId: actor.organizationId,
    tokenId: actor.tokenId,
    scopes: actor.scopes,
    auth: 'personal_access_token',
  };
}
