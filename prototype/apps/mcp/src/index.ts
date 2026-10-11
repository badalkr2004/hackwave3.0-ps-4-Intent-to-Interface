/**
 * Isolated Gestalt MCP server (stdio).
 * Does not modify Express routes or UI — only calls existing server services.
 *
 * Logs must go to stderr; stdout is the MCP JSON-RPC channel.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadMcpEnv } from './env';
import { registerAllTools } from './tools/register';

async function main() {
  // Validate MCP-only env early (also loads repo .env for DATABASE_URL / Google / Jira).
  loadMcpEnv();

  const server = new McpServer({
    name: 'gestalt-org',
    version: '0.1.0',
  });

  registerAllTools(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[gestalt-mcp] stdio server ready (org + Jira + Google Meet tools)');
}

main().catch((err) => {
  console.error('[gestalt-mcp] fatal:', err instanceof Error ? err.message : err);
  process.exit(1);
});
