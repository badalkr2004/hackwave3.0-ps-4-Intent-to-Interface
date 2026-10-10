-- Organizations, membership, invites, and meeting minutes (MOM) ingest.

CREATE TABLE organization (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE organization_member (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);
CREATE INDEX organization_member_user_idx ON organization_member (user_id);

CREATE TABLE organization_invite (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX organization_invite_org_idx ON organization_invite (organization_id);

ALTER TABLE user_workspace_prefs
  ADD COLUMN IF NOT EXISTS active_organization_id TEXT REFERENCES organization(id) ON DELETE SET NULL;

-- Full minutes archive (org-scoped). Synced into meetings for the auction/digest path.
CREATE TABLE meeting_minutes (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
  meeting_id TEXT,
  title TEXT NOT NULL,
  held_at TIMESTAMPTZ NOT NULL,
  raw_text TEXT NOT NULL,
  summary TEXT,
  decisions JSONB NOT NULL DEFAULT '[]',
  action_items JSONB NOT NULL DEFAULT '[]',
  attendees JSONB NOT NULL DEFAULT '[]',
  source TEXT NOT NULL DEFAULT 'paste',
  created_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX meeting_minutes_org_held_idx ON meeting_minutes (organization_id, held_at DESC);
CREATE INDEX meeting_minutes_client_held_idx ON meeting_minutes (client_id, held_at DESC);
