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

1. Authenticate the user and start a database transaction.
2. Set the authenticated user ID using transaction-local context, e.g. `SELECT set_config('app.user_id', $1, true)`.
3. Read only that user's membership rows from `workspace_members` to resolve the workspace.
4. Set the verified workspace ID using `SELECT set_config('app.workspace_id', $1, true)`.
5. Perform tenant queries inside that same transaction.
6. Commit or roll back before returning the response.

Use a database role that does not own the tables and does not have `BYPASSRLS`. Never accept a workspace ID from an untrusted browser request without checking membership. Do not use a pooled connection's session-level setting; use transaction-local state.

The migration deliberately does not create an authentication provider, database connection, or credentials. Those are separate integration steps. Do not run this migration against production until the database provider and migration workflow are configured and a backup/restore path exists.

## Server-side database access

The server-only PostgreSQL client is in `lib/db/client.ts`. It reads `DATABASE_URL`, uses a single connection per serverless instance, disables prepared statements for pooler compatibility, and never exposes connection details to the browser.

Use `listUserWorkspaces(userId)` to resolve the signed-in user's workspaces. Use `withWorkspaceTransaction(userId, workspaceId, callback)` for tenant data. The helper verifies membership before setting the transaction-local RLS workspace context. Only pass the authenticated user ID from the trusted session layer; never trust a user ID supplied by the browser.

The health endpoint's `capabilities.database` field reports whether a connection string is configured; it is not a live connectivity check.
