# @gestalt/mcp

Isolated stdio MCP server. Clients authenticate with a **personal access token** issued from Gestalt → **Connectors → IDE access**. The token is bound to a user **and organization** — no user ids in client config.

## Supported clients

| Client | Install |
|--------|---------|
| **Cursor** | **Add to Cursor** deeplink from Connectors |
| **Claude Code** | `.mcp.json` or `claude mcp add …` CLI |
| **Other hosts** (Windsurf, Continue, Cline, …) | Generic `mcpServers` JSON |
| **Custom clients** | `GESTALT_MCP_TOKEN` env (stdio) or `Authorization: Bearer` (when using HTTP) |

## Auth

1. Sign in to Gestalt and select an **active organization**.
2. Connectors → IDE access → **Connect IDE access** (creates `gst_mcp_…` token).
3. Install into your MCP client (token only in `env`).
4. Revoke anytime from the same panel.

MCP resolves identity + org from the token hash in `mcp_access_token`.

## Tools (org-scoped)

Org data, intent reports, Jira, Google Meet — including `org_intent_report` for natural-language portfolio reports.

## Run

```bash
# Cursor/Claude pass GESTALT_MCP_TOKEN in env; DATABASE_URL comes from repo .env
bun run --cwd apps/mcp start
```
