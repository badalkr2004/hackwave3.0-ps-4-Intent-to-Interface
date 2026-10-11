import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { jiraCredentialsForUser, listConnectors } from '../../../server/src/services/connectors';
import {
  createIssue,
  listProjects,
  resolveIssue,
  searchRecentIssues,
} from '../../../server/src/services/jira';
import { resolveActor } from '../actor';
import { fail, ok } from '../util';

export function registerJiraTools(server: McpServer) {
  server.tool(
    'connectors_status',
    'Show Jira and Google Meet connector connection status for the MCP user.',
    {},
    async () => {
      try {
        const actor = await resolveActor();
        const data = await listConnectors(actor.userId);
        return ok({
          jira: data.jira,
          google: data.google,
          catalog: data.catalog,
          defaults: data.defaults,
        });
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.tool(
    'list_jira_projects',
    'List Jira projects available to the connected (or env-default) Jira account.',
    {},
    async () => {
      try {
        const actor = await resolveActor();
        const { creds } = await jiraCredentialsForUser(actor.userId);
        const projects = await listProjects(creds);
        return ok({ projects });
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.tool(
    'list_jira_issues',
    'List recent Jira issues (optionally for a project key).',
    {
      projectKey: z.string().optional(),
      limit: z.number().int().min(1).max(50).optional(),
    },
    async ({ projectKey, limit }) => {
      try {
        const actor = await resolveActor();
        const { creds, projectKey: defaultKey } = await jiraCredentialsForUser(actor.userId);
        const issues = await searchRecentIssues(creds, {
          projectKey: projectKey ?? defaultKey,
          maxResults: limit ?? 15,
        });
        return ok({ issues, projectKey: projectKey ?? defaultKey ?? null });
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.tool(
    'create_jira_issue',
    'Create a Jira ticket (Task by default). Requires Jira connector or server JIRA_* env.',
    {
      summary: z.string().min(3),
      description: z.string().optional(),
      projectKey: z.string().optional().describe('Defaults to connected/env project key'),
      issueType: z.string().optional().describe('Default Task'),
    },
    async ({ summary, description, projectKey, issueType }) => {
      try {
        const actor = await resolveActor();
        const { creds, projectKey: defaultKey } = await jiraCredentialsForUser(actor.userId);
        const key = (projectKey ?? defaultKey ?? '').trim();
        if (!key) throw new Error('projectKey is required (or set a default on the Jira connector).');
        const issue = await createIssue(creds, {
          projectKey: key,
          summary,
          description,
          issueType,
        });
        return ok({ issue });
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.tool(
    'resolve_jira_issue',
    'Transition a Jira issue to Done/Resolved (available Done-category transition).',
    {
      issueKey: z.string().describe('e.g. KAN-12'),
    },
    async ({ issueKey }) => {
      try {
        const actor = await resolveActor();
        const { creds } = await jiraCredentialsForUser(actor.userId);
        const result = await resolveIssue(creds, issueKey.trim());
        return ok({ result });
      } catch (e) {
        return fail(e);
      }
    },
  );
}
