-- Personal access tokens for Gestalt MCP (Cursor, Claude Code, custom clients).
-- Plain token is shown once at issue time; only the hash is stored.

CREATE TABLE mcp_access_token (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'IDE',
  token_prefix TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  scopes JSONB NOT NULL DEFAULT '["org:read","org:write","jira","google"]'::jsonb,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX mcp_access_token_user_idx ON mcp_access_token (user_id, created_at DESC);
CREATE INDEX mcp_access_token_org_idx ON mcp_access_token (organization_id);
CREATE INDEX mcp_access_token_hash_idx ON mcp_access_token (token_hash);
