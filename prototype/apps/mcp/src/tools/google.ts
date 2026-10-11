import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  generateMomFromGoogleMeeting,
  listGoogleMeetings,
  scheduleGoogleMeeting,
  syncGoogleMeetingArtifacts,
} from '../../../server/src/services/googleMeet';
import { resolveActor } from '../actor';
import { fail, ok, truncate } from '../util';

export function registerGoogleTools(server: McpServer) {
  server.tool(
    'list_google_meetings',
    'List Google Meet meetings scheduled via Gestalt for the active organization.',
    {},
    async () => {
      try {
        const actor = await resolveActor();
        const meetings = await listGoogleMeetings(actor.userId);
        return ok({ meetings });
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.tool(
    'schedule_google_meeting',
    'Schedule a Google Calendar event with a Meet link and email invites. Requires Connect Google with Calendar scopes.',
    {
      title: z.string().min(2),
      startsAt: z.string().describe('ISO datetime'),
      endsAt: z.string().describe('ISO datetime'),
      attendees: z.array(z.string().email()).describe('Invitee emails'),
      description: z.string().optional(),
      clientId: z.string().nullable().optional().describe('Optional portfolio client id'),
    },
    async ({ title, startsAt, endsAt, attendees, description, clientId }) => {
      try {
        const actor = await resolveActor();
        const meeting = await scheduleGoogleMeeting(actor.userId, {
          title,
          startsAt,
          endsAt,
          attendees,
          description,
          clientId: clientId ?? null,
        });
        return ok({ meeting });
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.tool(
    'sync_google_meeting',
    'Sync Drive recording/transcript artifacts and calendar RSVPs for a Gestalt Google meeting.',
    {
      meetingId: z.string(),
    },
    async ({ meetingId }) => {
      try {
        const actor = await resolveActor();
        const meeting = await syncGoogleMeetingArtifacts(actor.userId, meetingId);
        return ok({
          meeting: {
            ...meeting,
            // transcript text is not on PublicGoogleMeeting; hasTranscript flag is enough
          },
        });
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.tool(
    'generate_google_mom',
    'Generate Gestalt MoM + action items from a synced Google Meet transcript for a portfolio client.',
    {
      meetingId: z.string(),
      clientId: z.string(),
    },
    async ({ meetingId, clientId }) => {
      try {
        const actor = await resolveActor();
        const result = await generateMomFromGoogleMeeting(actor.userId, meetingId, clientId);
        return ok({
          meeting: result.meeting,
          mom: {
            ...result.mom,
            summary: truncate(result.mom.summary, 1500),
          },
        });
      } catch (e) {
        return fail(e);
      }
    },
  );
}
