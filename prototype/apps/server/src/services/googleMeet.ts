import { and, desc, eq } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import { google } from 'googleapis';
import {
  googleMeeting,
  type GoogleMeetingAttendance,
  type GoogleMeetingAttendee,
} from '../db/auth-schema';
import { getDrizzle } from '../db/drizzle';
import { getGoogleOAuthClient } from './googleAuth';
import { extractMomText } from './momExtract';
import { getActiveOrgId, ingestMom, requireMember } from './orgs';

const id = (prefix: string) => `${prefix}_${randomBytes(8).toString('hex')}`;

function dbOrThrow() {
  const db = getDrizzle();
  if (!db) throw new Error('Database is not configured.');
  return db;
}

export type PublicGoogleMeeting = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  meetLink: string | null;
  htmlLink: string | null;
  attendees: GoogleMeetingAttendee[];
  attendance: GoogleMeetingAttendance[];
  clientId: string | null;
  status: 'scheduled' | 'completed' | 'cancelled';
  recordingUrl: string | null;
  recordingFileId: string | null;
  transcriptFileId: string | null;
  hasTranscript: boolean;
  meetingMinutesId: string | null;
  calendarEventId: string;
};

function toPublic(row: typeof googleMeeting.$inferSelect): PublicGoogleMeeting {
  return {
    id: row.id,
    title: row.title,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    meetLink: row.meetLink,
    htmlLink: row.htmlLink,
    attendees: row.attendees ?? [],
    attendance: row.attendance ?? [],
    clientId: row.clientId,
    status: row.status,
    recordingUrl: row.recordingUrl,
    recordingFileId: row.recordingFileId,
    transcriptFileId: row.transcriptFileId,
    hasTranscript: Boolean(row.transcriptText?.trim()),
    meetingMinutesId: row.meetingMinutesId,
    calendarEventId: row.calendarEventId,
  };
}

async function requireOrg(userId: string): Promise<string> {
  const orgId = await getActiveOrgId(userId);
  if (!orgId) throw new Error('Join or create an organization first.');
  await requireMember(userId, orgId);
  return orgId;
}

export async function listGoogleMeetings(userId: string): Promise<PublicGoogleMeeting[]> {
  const orgId = await requireOrg(userId);
  const db = dbOrThrow();
  const rows = await db
    .select()
    .from(googleMeeting)
    .where(eq(googleMeeting.organizationId, orgId))
    .orderBy(desc(googleMeeting.startsAt))
    .limit(40);
  return rows.map(toPublic);
}

export async function scheduleGoogleMeeting(
  userId: string,
  input: {
    title: string;
    startsAt: string;
    endsAt: string;
    attendees: string[];
    description?: string;
    clientId?: string | null;
  },
): Promise<PublicGoogleMeeting> {
  const orgId = await requireOrg(userId);
  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(input.endsAt);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    throw new Error('Provide valid start and end times.');
  }
  if (endsAt <= startsAt) throw new Error('End time must be after start time.');

  const emails = [...new Set(input.attendees.map((e) => e.trim().toLowerCase()).filter(Boolean))];
  const auth = await getGoogleOAuthClient(userId);
  const calendar = google.calendar({ version: 'v3', auth });

  const requestId = `gestalt-${randomBytes(8).toString('hex')}`;
  const created = await calendar.events.insert({
    calendarId: 'primary',
    conferenceDataVersion: 1,
    sendUpdates: 'all',
    requestBody: {
      summary: input.title.trim(),
      description: input.description?.trim() || undefined,
      start: { dateTime: startsAt.toISOString() },
      end: { dateTime: endsAt.toISOString() },
      attendees: emails.map((email) => ({ email })),
      conferenceData: {
        createRequest: {
          requestId,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
    },
  });

  const event = created.data;
  if (!event.id) throw new Error('Google Calendar did not return an event id.');

  const meetLink =
    event.hangoutLink ||
    event.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video')?.uri ||
    null;

  const attendees: GoogleMeetingAttendee[] = (event.attendees ?? []).map((a) => ({
    email: a.email ?? '',
    displayName: a.displayName ?? null,
    responseStatus: a.responseStatus ?? null,
  }));

  const rowId = id('gmeet');
  const db = dbOrThrow();
  const [row] = await db
    .insert(googleMeeting)
    .values({
      id: rowId,
      organizationId: orgId,
      createdBy: userId,
      calendarEventId: event.id,
      meetLink,
      htmlLink: event.htmlLink ?? null,
      title: event.summary || input.title.trim(),
      startsAt,
      endsAt,
      attendees,
      attendance: attendees,
      clientId: input.clientId || null,
      status: 'scheduled',
    })
    .returning();

  if (!row) throw new Error('Could not save meeting.');

  // Index scheduled meeting + pinned date into RAG (never blocks calendar write).
  try {
    const { ragIngestFireAndForget } = await import('./ragClient');
    const startIso = startsAt.toISOString();
    const endIso = endsAt.toISOString();
    const day = startIso.slice(0, 10);
    const attendeeLine = emails.length ? ` Attendees: ${emails.join(', ')}.` : '';
    ragIngestFireAndForget([
      {
        id: `gmeet:${rowId}`,
        title: row.title,
        text: [
          `Google Calendar meeting “${row.title}” pinned on ${day}.`,
          `Starts ${startIso}, ends ${endIso}.`,
          `Status: scheduled.`,
          meetLink ? `Meet link: ${meetLink}.` : '',
          input.description?.trim() ? `Agenda: ${input.description.trim()}` : '',
          attendeeLine,
          input.clientId ? `Portfolio client: ${input.clientId}.` : '',
        ]
          .filter(Boolean)
          .join(' '),
        source_type: 'google_calendar',
        org_id: orgId,
        client_id: input.clientId || '',
        date: day,
        tags: ['meeting', 'google', 'calendar', 'scheduled', day],
        access_tier: 'public',
      },
    ]);
  } catch {
    /* isolation: ignore */
  }

  return toPublic(row);
}

async function loadOwnedMeeting(userId: string, meetingId: string) {
  const orgId = await requireOrg(userId);
  const db = dbOrThrow();
  const [row] = await db
    .select()
    .from(googleMeeting)
    .where(and(eq(googleMeeting.id, meetingId), eq(googleMeeting.organizationId, orgId)))
    .limit(1);
  if (!row) throw new Error('Meeting not found.');
  return row;
}

/** Find Meet recording / transcript in Drive near the event window; refresh RSVP attendance. */
export async function syncGoogleMeetingArtifacts(
  userId: string,
  meetingId: string,
): Promise<PublicGoogleMeeting> {
  const row = await loadOwnedMeeting(userId, meetingId);
  const auth = await getGoogleOAuthClient(userId);
  const calendar = google.calendar({ version: 'v3', auth });
  const drive = google.drive({ version: 'v3', auth });

  let attendance: GoogleMeetingAttendance[] = row.attendance ?? [];
  try {
    const fresh = await calendar.events.get({
      calendarId: 'primary',
      eventId: row.calendarEventId,
    });
    if (fresh.data.attendees?.length) {
      attendance = fresh.data.attendees.map((a) => ({
        email: a.email ?? '',
        displayName: a.displayName ?? null,
        responseStatus: a.responseStatus ?? null,
      }));
    }
  } catch {
    /* keep stored attendance */
  }

  const start = new Date(row.startsAt.getTime() - 2 * 60 * 60 * 1000);
  const end = new Date(row.endsAt.getTime() + 48 * 60 * 60 * 1000);
  const titleSafe = row.title.replace(/'/g, "\\'");
  const q = [
    `modifiedTime >= '${start.toISOString()}'`,
    `modifiedTime <= '${end.toISOString()}'`,
    `(name contains 'Recording' or name contains 'Transcript' or name contains '${titleSafe.slice(0, 40)}')`,
  ].join(' and ');

  let recordingFileId = row.recordingFileId;
  let recordingUrl = row.recordingUrl;
  let transcriptFileId = row.transcriptFileId;
  let transcriptText = row.transcriptText;

  try {
    const listed = await drive.files.list({
      q,
      pageSize: 25,
      fields: 'files(id,name,mimeType,webViewLink,createdTime,modifiedTime)',
      orderBy: 'modifiedTime desc',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    for (const file of listed.data.files ?? []) {
      const name = (file.name ?? '').toLowerCase();
      const mime = file.mimeType ?? '';
      if (!recordingFileId && (name.includes('recording') || mime.startsWith('video/'))) {
        recordingFileId = file.id ?? null;
        recordingUrl = file.webViewLink ?? null;
      }
      if (
        !transcriptFileId &&
        (name.includes('transcript') ||
          mime === 'text/vtt' ||
          mime === 'application/vnd.google-apps.document')
      ) {
        transcriptFileId = file.id ?? null;
      }
    }
  } catch {
    /* Drive may deny; leave artifacts empty */
  }

  if (transcriptFileId && !transcriptText?.trim()) {
    try {
      transcriptText = await downloadTranscriptText(drive, transcriptFileId);
    } catch {
      /* ignore parse failures */
    }
  }

  const status =
    row.endsAt.getTime() < Date.now() && row.status === 'scheduled' ? 'completed' : row.status;

  const db = dbOrThrow();
  const [updated] = await db
    .update(googleMeeting)
    .set({
      attendance,
      attendees: attendance,
      recordingFileId,
      recordingUrl,
      transcriptFileId,
      transcriptText,
      status,
      updatedAt: new Date(),
    })
    .where(eq(googleMeeting.id, row.id))
    .returning();

  return toPublic(updated!);
}

async function downloadTranscriptText(
  drive: ReturnType<typeof google.drive>,
  fileId: string,
): Promise<string> {
  const meta = await drive.files.get({
    fileId,
    fields: 'id,name,mimeType',
    supportsAllDrives: true,
  });
  const mime = meta.data.mimeType ?? '';
  const name = meta.data.name ?? 'transcript.txt';

  if (mime === 'application/vnd.google-apps.document') {
    const exported = await drive.files.export(
      { fileId, mimeType: 'text/plain' },
      { responseType: 'arraybuffer' },
    );
    const bytes = new Uint8Array(exported.data as ArrayBuffer);
    const { text } = await extractMomText({ filename: `${name}.txt`, mime: 'text/plain', bytes });
    return text;
  }

  const downloaded = await drive.files.get(
    { fileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'arraybuffer' },
  );
  const bytes = new Uint8Array(downloaded.data as ArrayBuffer);
  const { text } = await extractMomText({ filename: name, mime, bytes });
  return text;
}

export async function generateMomFromGoogleMeeting(
  userId: string,
  meetingId: string,
  clientId: string,
): Promise<{ meeting: PublicGoogleMeeting; mom: Awaited<ReturnType<typeof ingestMom>> }> {
  let row = await loadOwnedMeeting(userId, meetingId);
  if (!row.transcriptText?.trim()) {
    await syncGoogleMeetingArtifacts(userId, meetingId);
    row = await loadOwnedMeeting(userId, meetingId);
  }
  const transcript = row.transcriptText?.trim();
  if (!transcript || transcript.length < 40) {
    throw new Error(
      'No transcript text yet. After the Meet ends (with recording/transcript enabled), use Sync artifacts, then try again.',
    );
  }

  const mom = await ingestMom({
    organizationId: row.organizationId,
    userId,
    clientId,
    rawText: transcript,
    title: row.title,
    heldAt: row.startsAt.toISOString(),
    source: 'google_meet',
  });

  const db = dbOrThrow();
  const [updated] = await db
    .update(googleMeeting)
    .set({
      meetingMinutesId: mom.id,
      clientId,
      status: 'completed',
      updatedAt: new Date(),
    })
    .where(eq(googleMeeting.id, row.id))
    .returning();

  return { meeting: toPublic(updated!), mom };
}
