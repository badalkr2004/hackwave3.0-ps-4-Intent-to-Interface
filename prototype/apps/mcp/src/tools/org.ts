import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { buildAnalyticsReport } from '../../../server/src/services/analytics';
import { listActionItems, updateActionItem } from '../../../server/src/services/orgActions';
import {
  ingestMom,
  listClientsForOrg,
  listMembers,
  listMom,
} from '../../../server/src/services/orgs';
import { actorSummary, resolveActor } from '../actor';
import { fail, ok, truncate } from '../util';

export function registerOrgTools(server: McpServer) {
  server.tool(
    'org_context',
    'Token-bound Gestalt user, organization, members, and linked portfolio clients summary.',
    {},
    async () => {
      try {
        const summary = await actorSummary();
        const actor = await resolveActor();
        const members = await listMembers(actor.organizationId, actor.userId);
        const clients = await listClientsForOrg(actor.organizationId, actor.userId);
        return ok({ ...summary, members, clientCount: clients.length, clients });
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.tool(
    'list_clients',
    'List portfolio clients linked to the active organization.',
    {},
    async () => {
      try {
        const actor = await resolveActor();
        const clients = await listClientsForOrg(actor.organizationId, actor.userId);
        return ok({ clients });
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.tool(
    'list_mom',
    'List recent meeting minutes (MoM) for the active organization.',
    {
      limit: z.number().int().min(1).max(50).optional().describe('Max rows (default 10)'),
    },
    async ({ limit }) => {
      try {
        const actor = await resolveActor();
        const rows = await listMom(actor.organizationId, actor.userId, limit ?? 10);
        return ok({
          meetings: rows.map((r) => ({
            ...r,
            summary: truncate(r.summary, 1500),
          })),
        });
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.tool(
    'ingest_mom',
    'Create meeting minutes from pasted transcript/notes text for a portfolio client.',
    {
      clientId: z.string().describe('Portfolio client id'),
      rawText: z.string().min(40).describe('Meeting notes or transcript'),
      title: z.string().optional(),
      heldAt: z.string().optional().describe('ISO datetime when the meeting was held'),
    },
    async ({ clientId, rawText, title, heldAt }) => {
      try {
        const actor = await resolveActor();
        const mom = await ingestMom({
          organizationId: actor.organizationId,
          userId: actor.userId,
          clientId,
          rawText,
          title,
          heldAt,
          source: 'mcp',
        });
        return ok({ mom });
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.tool(
    'list_action_items',
    'List organization action items (from MoM), optionally filtered by status.',
    {
      status: z.enum(['open', 'done', 'missed', 'all']).optional(),
    },
    async ({ status }) => {
      try {
        const actor = await resolveActor();
        const items = await listActionItems(actor.organizationId, actor.userId, {
          status: status ?? 'all',
        });
        return ok({ items });
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.tool(
    'update_action_item',
    'Update an action item status, owner, or due date.',
    {
      itemId: z.string(),
      status: z.enum(['open', 'done', 'missed']).optional(),
      owner: z.string().nullable().optional(),
      due: z.string().nullable().optional().describe('YYYY-MM-DD or null'),
    },
    async ({ itemId, status, owner, due }) => {
      try {
        const actor = await resolveActor();
        const item = await updateActionItem(actor.organizationId, actor.userId, itemId, {
          status,
          owner,
          due,
        });
        return ok({ item });
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.tool(
    'analytics_report',
    'Build the organization analytics report (pipeline / health snapshot).',
    {
      range: z.enum(['30d', '90d', 'ytd']).optional(),
      clientId: z.string().nullable().optional(),
    },
    async ({ range, clientId }) => {
      try {
        const actor = await resolveActor();
        const report = await buildAnalyticsReport(actor.organizationId, actor.userId, {
          range,
          clientId: clientId ?? null,
        });
        return ok({ report });
      } catch (e) {
        return fail(e);
      }
    },
  );
}
