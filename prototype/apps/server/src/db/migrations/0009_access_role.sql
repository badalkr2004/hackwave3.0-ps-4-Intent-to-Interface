-- Job / data access role (separate from org governance owner|admin|member).
ALTER TABLE organization_member
  ADD COLUMN IF NOT EXISTS access_role TEXT NOT NULL DEFAULT 'manager';

ALTER TABLE organization_member
  DROP CONSTRAINT IF EXISTS organization_member_access_role_check;

ALTER TABLE organization_member
  ADD CONSTRAINT organization_member_access_role_check
  CHECK (access_role IN ('manager', 'developer', 'intern'));

COMMENT ON COLUMN organization_member.access_role IS
  'Dashboard/RAG data scope: manager=all, developer=engineering, intern=narrow public';
