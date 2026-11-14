import postgres from "postgres";

const globalForDatabase = globalThis as typeof globalThis & {
  viralCutDatabase?: ReturnType<typeof postgres>;
};

/** Server-only, small PostgreSQL pool for serverless execution. */
export function getDatabase() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not configured.");

  if (!globalForDatabase.viralCutDatabase) {
    globalForDatabase.viralCutDatabase = postgres(connectionString, {
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false
    });
  }

  return globalForDatabase.viralCutDatabase;
}
