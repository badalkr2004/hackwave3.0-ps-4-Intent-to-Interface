-- Per-user tool connectors (Jira, etc.). Secrets may be omitted when env defaults apply.
ALTER TABLE user_workspace_prefs
  ADD COLUMN IF NOT EXISTS connectors JSONB NOT NULL DEFAULT '{}'::jsonb;
