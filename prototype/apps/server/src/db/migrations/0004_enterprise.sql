-- Action items, audit log, and org↔client scoping for multi-tenant MOM workflows.

CREATE TABLE organization_client (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, client_id)
);
CREATE INDEX organization_client_org_idx ON organization_client (organization_id);

CREATE TABLE org_action_item (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  meeting_minutes_id TEXT REFERENCES meeting_minutes(id) ON DELETE SET NULL,
  client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
  text TEXT NOT NULL,
  owner TEXT,
  due DATE,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done', 'missed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX org_action_item_org_status_idx ON org_action_item (organization_id, status, due);

CREATE TABLE organization_audit_log (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  actor_user_id TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  detail JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX organization_audit_log_org_idx ON organization_audit_log (organization_id, created_at DESC);

-- Existing orgs inherit the demo portfolio so MOM scoping works immediately.
INSERT INTO organization_client (id, organization_id, client_id)
SELECT
  'oc_' || substr(md5(random()::text || o.id || c.id), 1, 16),
  o.id,
  c.id
FROM organization o
CROSS JOIN clients c
ON CONFLICT DO NOTHING;
