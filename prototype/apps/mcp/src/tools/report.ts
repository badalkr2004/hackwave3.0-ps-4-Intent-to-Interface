import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { buildOrgIntentReport } from '../../../server/src/services/mcpIntentReport';
import { resolveActor } from '../actor';
import { fail, ok } from '../util';

export function registerReportTools(server: McpServer) {
  server.tool(
    'org_intent_report',
    'Generate an intent-based organization report (clients, MoM, action items, analytics, Jira, Meet) for the token-bound org. Pass a natural-language intent such as “pipeline overview”, “overdue actions”, or “jira + clients”.',
    {
      intent: z
        .string()
        .min(2)
        .describe('What you want reported, e.g. "sales pipeline and open actions"'),
    },
    async ({ intent }) => {
      try {
        const actor = await resolveActor();
        const report = await buildOrgIntentReport(
          actor.userId,
          actor.organizationId,
          intent,
        );
        return ok(report);
      } catch (e) {
        return fail(e);
      }
    },
  );
}
