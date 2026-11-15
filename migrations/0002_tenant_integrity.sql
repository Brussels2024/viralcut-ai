-- ViralCut AI tenant-integrity hardening.
-- Apply after 0001_initial.sql using the dedicated ViralCut database role.
--
-- Preflight: resolve any duplicate emails differing only by case/whitespace
-- before applying this migration.

CREATE UNIQUE INDEX app_users_email_normalized_unique
  ON app_users (lower(btrim(email)));

-- A project creator must be a member of the workspace that owns the project.
ALTER TABLE media_projects
  ADD CONSTRAINT media_projects_creator_membership_fk
  FOREIGN KEY (workspace_id, created_by)
  REFERENCES workspace_members(workspace_id, user_id)
  ON DELETE RESTRICT;

-- Usage attribution must not point at a user outside the billed workspace.
-- NULL user_id remains valid for system-generated usage events.
ALTER TABLE usage_events
  ADD CONSTRAINT usage_events_user_membership_fk
  FOREIGN KEY (workspace_id, user_id)
  REFERENCES workspace_members(workspace_id, user_id)
  ON DELETE RESTRICT;
