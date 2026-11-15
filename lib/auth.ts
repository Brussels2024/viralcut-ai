import { betterAuth } from "better-auth";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
const pool = connectionString ? new Pool({ connectionString, max: 5, idleTimeoutMillis: 20_000, connectionTimeoutMillis: 10_000, ssl: connectionString.includes("localhost") ? undefined : { rejectUnauthorized: false } }) : null;

async function sendEmail(to: string, subject: string, html: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) throw new Error("RESEND_API_KEY e EMAIL_FROM precisam estar configurados para enviar e-mails de autenticação.");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, html })
  });
  if (!response.ok) throw new Error(`Falha no serviço de e-mail: ${response.status}`);
}

export const auth = betterAuth({
  appName: "ViralCut AI",
  database: pool ?? undefined,
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  trustedOrigins: process.env.BETTER_AUTH_URL ? [process.env.BETTER_AUTH_URL] : [],
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    sendResetPassword: async ({ user, url }) => sendEmail(
      user.email,
      "Redefina sua senha do ViralCut AI",
      `<p>Olá, ${user.name || "criador"}.</p><p>Recebemos uma solicitação para redefinir sua senha.</p><p><a href="${url}">Criar uma nova senha</a></p><p>Se não foi você, ignore esta mensagem.</p>`
    )
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => sendEmail(
      user.email,
      "Confirme seu e-mail no ViralCut AI",
      `<p>Olá, ${user.name || "criador"}.</p><p>Confirme seu endereço de e-mail para ativar sua conta.</p><p><a href="${url}">Confirmar e-mail</a></p>`
    )
  },
  socialProviders: {
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET ? {
      google: { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET }
    } : {})
  },
  advanced: { database: { generateId: "uuid" }, useSecureCookies: process.env.NODE_ENV === "production" },
  session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24, cookieCache: { enabled: true, maxAge: 5 * 60 } },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          if (!pool) throw new Error("DATABASE_URL não configurada.");
          const client = await pool.connect();
          try {
            await client.query("BEGIN");
            await client.query(
              `INSERT INTO app_users (id, auth_provider, auth_provider_user_id, email, display_name)
               VALUES ($1, 'better-auth', $1, $2, $3)
               ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, display_name = EXCLUDED.display_name`,
              [user.id, user.email, user.name || null]
            );
            const workspace = await client.query(
              "INSERT INTO workspaces (name, owner_user_id) VALUES ($1, $2) RETURNING id",
              [`${user.name || "Meu"} workspace`, user.id]
            );
            await client.query(
              "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'owner') ON CONFLICT DO NOTHING",
              [workspace.rows[0].id, user.id]
            );
            await client.query("COMMIT");
          } catch (error) { await client.query("ROLLBACK"); throw error; }
          finally { client.release(); }
        }
      }
    }
  }
});
