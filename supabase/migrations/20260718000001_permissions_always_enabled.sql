-- Permissions are always enabled: new photography_sessions rows default both
-- permissions on, and existing rows are backfilled. Rows where marketing
-- permission was explicitly revoked (marketing_permission_revoked_at set) are
-- left untouched — a real client revocation must not be silently undone.

alter table photography_sessions alter column marketing_permission set default true;
alter table photography_sessions alter column ai_processing_allowed set default true;

update photography_sessions set
  marketing_permission = true,
  marketing_permission_source = coalesce(marketing_permission_source, 'contract'),
  marketing_permission_confirmed_at = coalesce(marketing_permission_confirmed_at, now())
where marketing_permission = false
  and marketing_permission_revoked_at is null;

update photography_sessions set
  ai_processing_allowed = true,
  ai_processing_basis = coalesce(ai_processing_basis, 'contract'),
  ai_processing_policy_version = coalesce(ai_processing_policy_version, '2026-06-06'),
  ai_processing_confirmed_at = coalesce(ai_processing_confirmed_at, now())
where ai_processing_allowed = false;
