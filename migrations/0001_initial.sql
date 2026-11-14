-- ViralCut AI initial PostgreSQL schema.
-- Apply with a migration runner using a dedicated application role.
-- UUID generation is provided by PostgreSQL 13+.

CREATE TABLE app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_provider text NOT NULL,
  auth_provider_user_id text NOT NULL,
  email text NOT NULL,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_users_provider_identity_unique UNIQUE (auth_provider, auth_provider_user_id),
  CONSTRAINT app_users_email_unique UNIQUE (email)
);

CREATE TABLE workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
  owner_user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE workspace_members (
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);

CREATE TABLE media_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 180),
  source_type text NOT NULL CHECK (source_type IN ('upload', 'recorded_url', 'live_stream')),
  source_platform text,
  source_url text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'queued', 'processing', 'completed', 'failed', 'archived')),
  duration_seconds integer CHECK (duration_seconds IS NULL OR duration_seconds > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES media_projects(id) ON DELETE CASCADE,
  asset_kind text NOT NULL CHECK (asset_kind IN ('original_video', 'audio', 'thumbnail', 'proxy', 'rendered_video')),
  storage_provider text NOT NULL DEFAULT 'cloudflare_r2',
  storage_key text NOT NULL,
  content_type text NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes > 0),
  checksum_sha256 text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT media_assets_storage_key_unique UNIQUE (storage_provider, storage_key)
);

CREATE TABLE analysis_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES media_projects(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
  stage text NOT NULL DEFAULT 'pending',
  progress smallint NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  error_code text,
  error_message text,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE transcript_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES media_projects(id) ON DELETE CASCADE,
  segment_index integer NOT NULL CHECK (segment_index >= 0),
  start_seconds numeric(12,3) NOT NULL CHECK (start_seconds >= 0),
  end_seconds numeric(12,3) NOT NULL,
  text text NOT NULL,
  confidence numeric(5,4) CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT transcript_segment_time_valid CHECK (end_seconds > start_seconds),
  CONSTRAINT transcript_segment_index_unique UNIQUE (project_id, segment_index)
);

CREATE TABLE clip_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES media_projects(id) ON DELETE CASCADE,
  analysis_job_id uuid REFERENCES analysis_jobs(id) ON DELETE SET NULL,
  start_seconds numeric(12,3) NOT NULL CHECK (start_seconds >= 0),
  end_seconds numeric(12,3) NOT NULL,
  score numeric(5,2) NOT NULL CHECK (score BETWEEN 0 AND 100),
  title text NOT NULL,
  hook text NOT NULL,
  description text NOT NULL,
  hashtags jsonb NOT NULL DEFAULT '[]'::jsonb,
  reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  selected boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT clip_candidate_time_valid CHECK (
    end_seconds > start_seconds AND end_seconds - start_seconds BETWEEN 60 AND 90
  )
);

CREATE TABLE rendered_clips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES media_projects(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES clip_candidates(id) ON DELETE CASCADE,
  asset_id uuid REFERENCES media_assets(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'rendering', 'completed', 'failed')),
  aspect_ratio text NOT NULL DEFAULT '9:16',
  resolution text NOT NULL DEFAULT '1080x1920',
  subtitles_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  quantity numeric(14,3) NOT NULL CHECK (quantity >= 0),
  unit text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  provider_event_id text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT webhook_provider_event_unique UNIQUE (provider, provider_event_id)
);


-- Composite tenant-aware foreign keys prevent a row in one workspace from
-- referencing a project, asset, job, or candidate owned by another workspace.
ALTER TABLE media_projects
  ADD CONSTRAINT media_projects_id_workspace_unique UNIQUE (id, workspace_id);
ALTER TABLE media_assets
  ADD CONSTRAINT media_assets_id_workspace_unique UNIQUE (id, workspace_id);
ALTER TABLE analysis_jobs
  ADD CONSTRAINT analysis_jobs_id_workspace_unique UNIQUE (id, workspace_id);
ALTER TABLE clip_candidates
  ADD CONSTRAINT clip_candidates_id_workspace_unique UNIQUE (id, workspace_id);

ALTER TABLE media_assets
  ADD CONSTRAINT media_assets_project_workspace_fk
  FOREIGN KEY (project_id, workspace_id)
  REFERENCES media_projects(id, workspace_id) ON DELETE CASCADE;
ALTER TABLE analysis_jobs
  ADD CONSTRAINT analysis_jobs_project_workspace_fk
  FOREIGN KEY (project_id, workspace_id)
  REFERENCES media_projects(id, workspace_id) ON DELETE CASCADE;
ALTER TABLE transcript_segments
  ADD CONSTRAINT transcript_segments_project_workspace_fk
  FOREIGN KEY (project_id, workspace_id)
  REFERENCES media_projects(id, workspace_id) ON DELETE CASCADE;
ALTER TABLE clip_candidates
  ADD CONSTRAINT clip_candidates_project_workspace_fk
  FOREIGN KEY (project_id, workspace_id)
  REFERENCES media_projects(id, workspace_id) ON DELETE CASCADE;
ALTER TABLE clip_candidates
  ADD CONSTRAINT clip_candidates_job_workspace_fk
  FOREIGN KEY (analysis_job_id, workspace_id)
  REFERENCES analysis_jobs(id, workspace_id) ON DELETE SET NULL;
ALTER TABLE rendered_clips
  ADD CONSTRAINT rendered_clips_project_workspace_fk
  FOREIGN KEY (project_id, workspace_id)
  REFERENCES media_projects(id, workspace_id) ON DELETE CASCADE;
ALTER TABLE rendered_clips
  ADD CONSTRAINT rendered_clips_candidate_workspace_fk
  FOREIGN KEY (candidate_id, workspace_id)
  REFERENCES clip_candidates(id, workspace_id) ON DELETE CASCADE;
ALTER TABLE rendered_clips
  ADD CONSTRAINT rendered_clips_asset_workspace_fk
  FOREIGN KEY (asset_id, workspace_id)
  REFERENCES media_assets(id, workspace_id) ON DELETE SET NULL;

CREATE INDEX workspace_members_user_idx ON workspace_members(user_id);
CREATE INDEX media_projects_workspace_created_idx ON media_projects(workspace_id, created_at DESC);
CREATE INDEX media_assets_project_idx ON media_assets(project_id);
CREATE INDEX analysis_jobs_workspace_status_idx ON analysis_jobs(workspace_id, status, created_at);
CREATE INDEX transcript_segments_project_time_idx ON transcript_segments(project_id, start_seconds);
CREATE INDEX clip_candidates_project_score_idx ON clip_candidates(project_id, score DESC);
CREATE INDEX rendered_clips_project_status_idx ON rendered_clips(project_id, status);
CREATE INDEX usage_events_workspace_created_idx ON usage_events(workspace_id, created_at DESC);

-- Tenant isolation: the API must set app.workspace_id with SET LOCAL for every
-- transaction that accesses workspace-owned rows. Use a non-owner DB role.
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcript_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE clip_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE rendered_clips ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY workspace_members_self_read_policy ON workspace_members
  FOR SELECT
  USING (user_id = nullif(current_setting('app.user_id', true), '')::uuid);
CREATE POLICY media_projects_tenant_policy ON media_projects
  USING (workspace_id = nullif(current_setting('app.workspace_id', true), '')::uuid)
  WITH CHECK (workspace_id = nullif(current_setting('app.workspace_id', true), '')::uuid);
CREATE POLICY media_assets_tenant_policy ON media_assets
  USING (workspace_id = nullif(current_setting('app.workspace_id', true), '')::uuid)
  WITH CHECK (workspace_id = nullif(current_setting('app.workspace_id', true), '')::uuid);
CREATE POLICY analysis_jobs_tenant_policy ON analysis_jobs
  USING (workspace_id = nullif(current_setting('app.workspace_id', true), '')::uuid)
  WITH CHECK (workspace_id = nullif(current_setting('app.workspace_id', true), '')::uuid);
CREATE POLICY transcript_segments_tenant_policy ON transcript_segments
  USING (workspace_id = nullif(current_setting('app.workspace_id', true), '')::uuid)
  WITH CHECK (workspace_id = nullif(current_setting('app.workspace_id', true), '')::uuid);
CREATE POLICY clip_candidates_tenant_policy ON clip_candidates
  USING (workspace_id = nullif(current_setting('app.workspace_id', true), '')::uuid)
  WITH CHECK (workspace_id = nullif(current_setting('app.workspace_id', true), '')::uuid);
CREATE POLICY rendered_clips_tenant_policy ON rendered_clips
  USING (workspace_id = nullif(current_setting('app.workspace_id', true), '')::uuid)
  WITH CHECK (workspace_id = nullif(current_setting('app.workspace_id', true), '')::uuid);
CREATE POLICY usage_events_tenant_policy ON usage_events
  USING (workspace_id = nullif(current_setting('app.workspace_id', true), '')::uuid)
  WITH CHECK (workspace_id = nullif(current_setting('app.workspace_id', true), '')::uuid);
