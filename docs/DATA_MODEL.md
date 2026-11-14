# Data model and tenant isolation

The initial PostgreSQL schema is in `migrations/0001_initial.sql`.

## Model

- `app_users`: stable application identity mapped to an external authentication provider.
- `workspaces` and `workspace_members`: account boundary and membership roles.
- `media_projects`: a recording or live-stream project and its lifecycle.
- `media_assets`: private object-storage references; file bytes remain in R2.
- `analysis_jobs`: asynchronous processing state and retry metadata.
- `transcript_segments`: timestamped speech recognized from source media.
- `clip_candidates`: ranked 60–90 second moments and publishing metadata.
- `rendered_clips`: export/render state and output asset reference.
- `usage_events`: append-only metering foundation.
- `webhook_events`: provider event idempotency.

## Tenant isolation requirements

Workspace-owned tables have PostgreSQL row-level security enabled. Every server-side database transaction must:

1. Authenticate the user and resolve their workspace membership.
2. Start a database transaction.
3. Set the verified workspace ID using transaction-local context, e.g. `SELECT set_config('app.workspace_id', $1, true)`.
4. Perform all tenant queries inside that same transaction.
5. Commit or roll back before returning the response.

Use a database role that does not own the tables and does not have `BYPASSRLS`. Never accept a workspace ID from an untrusted browser request without checking membership. Do not use a pooled connection's session-level setting; use transaction-local state.

The migration deliberately does not create an authentication provider, database connection, or credentials. Those are separate integration steps. Do not run this migration against production until the database provider and migration workflow are configured and a backup/restore path exists.
