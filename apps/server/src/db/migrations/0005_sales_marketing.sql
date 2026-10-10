-- Org-scoped sales pipeline and marketing analytics.

CREATE TABLE sales_opportunity (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  stage TEXT NOT NULL CHECK (stage IN ('lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost')),
  amount NUMERIC NOT NULL,
  probability NUMERIC NOT NULL DEFAULT 0,
  owner TEXT,
  expected_close DATE,
  closed_at DATE,
  lost_reason TEXT,
  source_channel TEXT NOT NULL CHECK (
    source_channel IN ('email', 'paid_search', 'social', 'event', 'partner', 'content', 'referral')
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX sales_opportunity_org_idx ON sales_opportunity (organization_id, stage);
CREATE INDEX sales_opportunity_client_idx ON sales_opportunity (organization_id, client_id);

CREATE TABLE marketing_campaign (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (
    channel IN ('email', 'paid_search', 'social', 'event', 'partner', 'content')
  ),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('planned', 'active', 'completed')),
  spend NUMERIC NOT NULL DEFAULT 0,
  leads INTEGER NOT NULL DEFAULT 0,
  mqls INTEGER NOT NULL DEFAULT 0,
  opportunities INTEGER NOT NULL DEFAULT 0,
  revenue_attributed NUMERIC NOT NULL DEFAULT 0,
  started_at DATE NOT NULL,
  ended_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX marketing_campaign_org_idx ON marketing_campaign (organization_id, channel);

CREATE TABLE marketing_channel_daily (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  channel TEXT NOT NULL CHECK (
    channel IN ('email', 'paid_search', 'social', 'event', 'partner', 'content')
  ),
  sessions INTEGER NOT NULL DEFAULT 0,
  leads INTEGER NOT NULL DEFAULT 0,
  spend NUMERIC NOT NULL DEFAULT 0,
  UNIQUE (organization_id, date, channel)
);
CREATE INDEX marketing_channel_daily_org_date_idx ON marketing_channel_daily (organization_id, date);
