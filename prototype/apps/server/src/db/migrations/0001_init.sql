-- SPEC-NOTE: table names are unqualified; the migration runner creates the target schema
-- (DB_SCHEMA, default "gestalt") and sets search_path for the transaction, so the same file
-- also builds the "gestalt_test" schema used by integration tests.

CREATE TABLE people (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL, capacity_pct INTEGER NOT NULL);

CREATE TABLE clients (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, plan TEXT NOT NULL, arr INTEGER NOT NULL, health INTEGER NOT NULL,
  csm_id TEXT REFERENCES people(id), renewal_date DATE, contact_name TEXT, contact_title TEXT);

CREATE TABLE releases (
  id TEXT PRIMARY KEY, version TEXT NOT NULL, date DATE NOT NULL, notes TEXT,
  features JSONB NOT NULL DEFAULT '[]');

CREATE TABLE usage_daily (
  client_id TEXT NOT NULL REFERENCES clients(id), date DATE NOT NULL,
  dimension TEXT NOT NULL CHECK (dimension IN ('total','feature','team')),
  segment TEXT NOT NULL, value DOUBLE PRECISION NOT NULL,
  PRIMARY KEY (client_id, date, dimension, segment));
CREATE INDEX usage_daily_client_date_idx ON usage_daily (client_id, date DESC);

CREATE TABLE tickets (
  id TEXT PRIMARY KEY, client_id TEXT NOT NULL REFERENCES clients(id), title TEXT NOT NULL,
  status TEXT NOT NULL, priority TEXT NOT NULL, created TIMESTAMPTZ NOT NULL, updated TIMESTAMPTZ NOT NULL,
  tags JSONB NOT NULL DEFAULT '[]', summary TEXT);
CREATE INDEX tickets_client_idx ON tickets (client_id, status);

CREATE TABLE communications (
  id TEXT PRIMARY KEY, client_id TEXT NOT NULL REFERENCES clients(id), channel TEXT NOT NULL,
  date TIMESTAMPTZ NOT NULL, direction TEXT NOT NULL, sender TEXT NOT NULL, subject TEXT, snippet TEXT NOT NULL,
  sentiment DOUBLE PRECISION NOT NULL);
CREATE INDEX comms_client_date_idx ON communications (client_id, date DESC);

CREATE TABLE meetings (
  id TEXT PRIMARY KEY, client_id TEXT NOT NULL REFERENCES clients(id), date TIMESTAMPTZ NOT NULL,
  kind TEXT NOT NULL, title TEXT NOT NULL, notes TEXT,
  commitments JSONB NOT NULL DEFAULT '[]');

CREATE TABLE projects (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, client_id TEXT REFERENCES clients(id),
  owner_id TEXT REFERENCES people(id));

CREATE TABLE tasks (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), title TEXT NOT NULL,
  owner_id TEXT REFERENCES people(id), due DATE NOT NULL, status TEXT NOT NULL,
  depends_on JSONB NOT NULL DEFAULT '[]', estimate_h INTEGER);
CREATE INDEX tasks_project_due_idx ON tasks (project_id, due);
