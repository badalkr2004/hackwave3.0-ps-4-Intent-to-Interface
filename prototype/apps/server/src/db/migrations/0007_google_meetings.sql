-- Google Meet / Calendar meetings scheduled from Gestalt connectors.

CREATE TABLE google_meeting (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  created_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  calendar_event_id TEXT NOT NULL,
  meet_link TEXT,
  html_link TEXT,
  title TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  attendees JSONB NOT NULL DEFAULT '[]'::jsonb,
  client_id TEXT,
  recording_file_id TEXT,
  recording_url TEXT,
  transcript_file_id TEXT,
  transcript_text TEXT,
  attendance JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  meeting_minutes_id TEXT REFERENCES meeting_minutes(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX google_meeting_org_starts_idx ON google_meeting (organization_id, starts_at DESC);
CREATE INDEX google_meeting_created_by_idx ON google_meeting (created_by);
CREATE UNIQUE INDEX google_meeting_event_uidx ON google_meeting (organization_id, calendar_event_id);
