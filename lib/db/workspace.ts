import type { TransactionSql } from "postgres";
import { getDatabase } from "./client";

export type WorkspaceMembership = {
  workspace_id: string;
  role: "owner" | "admin" | "member";
};

/** Verify membership and set transaction-local RLS context before tenant queries. */
export async function withWorkspaceTransaction<T>(
  userId: string,
  workspaceId: string,
  operation: (transaction: TransactionSql) => Promise<T>
): Promise<T> {
  if (!userId || !workspaceId) {
    throw new Error("Authenticated user and workspace are required.");
  }

  const database = getDatabase();
  const result = await database.begin(async (transaction) => {
    await transaction`SELECT set_config('app.user_id', ${userId}, true)`;

    const memberships = await transaction<WorkspaceMembership[]>`
      SELECT workspace_id, role
      FROM workspace_members
      WHERE workspace_id = ${workspaceId}
        AND user_id = ${userId}
      LIMIT 1
    `;

    if (memberships.length !== 1) throw new Error("WORKSPACE_ACCESS_DENIED");

    await transaction`SELECT set_config('app.workspace_id', ${workspaceId}, true)`;
    return operation(transaction);
  });

  return result as T;
}

/** Resolve only workspaces where the authenticated user has a membership. */
export async function listUserWorkspaces(userId: string) {
  if (!userId) throw new Error("Authenticated user is required.");

  const database = getDatabase();
  return database.begin(async (transaction) => {
    await transaction`SELECT set_config('app.user_id', ${userId}, true)`;
    return transaction`
      SELECT w.id, w.name, wm.role, wm.created_at AS joined_at
      FROM workspace_members AS wm
      INNER JOIN workspaces AS w ON w.id = wm.workspace_id
      WHERE wm.user_id = ${userId}
      ORDER BY wm.created_at ASC
    `;
  });
}
