import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerGoogleTools } from './google';
import { registerJiraTools } from './jira';
import { registerOrgTools } from './org';
import { registerReportTools } from './report';

export function registerAllTools(server: McpServer) {
  registerOrgTools(server);
  registerReportTools(server);
  registerJiraTools(server);
  registerGoogleTools(server);
}
