import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import type { JWT } from "next-auth/jwt";
import { persistGoogleOAuthAccount } from "@/lib/google-account";
import { prisma } from "@/lib/prisma";

const scopes = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/webmasters.readonly",
  "https://www.googleapis.com/auth/analytics.readonly",
].join(" ");

async function refreshGoogleAccessToken(token: JWT): Promise<JWT> {
  if (!token.refreshToken) {
    return { ...token, error: "RefreshAccessTokenError" };
  }
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return { ...token, error: "RefreshAccessTokenError" };
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: token.refreshToken,
    }),
  });

  if (!res.ok) {
    return { ...token, error: "RefreshAccessTokenError" };
  }

  const json = (await res.json()) as {
    access_token: string;
    expires_in?: number;
    refresh_token?: string;
  };

  return {
    ...token,
    accessToken: json.access_token,
    expiresAt: Math.floor(Date.now() / 1000) + (json.expires_in ?? 3600),
    refreshToken: json.refresh_token ?? token.refreshToken,
    error: undefined,
  };
}

export const { handlers, auth, signIn, signOut } = NextAuth(() => {
  const clientId = process.env.GOOGLE_CLIENT_ID || "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
  const googleReady = Boolean(clientId && clientSecret);

  return {
    // JWT sessions so Google login works without Postgres.
    session: { strategy: "jwt" },
    secret: process.env.AUTH_SECRET,
    providers: googleReady
      ? [
          Google({
            clientId,
            clientSecret,
            authorization: {
              params: {
                scope: scopes,
                access_type: "offline",
                prompt: "select_account consent",
                include_granted_scopes: "true",
              },
            },
          }),
        ]
      : [],
    callbacks: {
      async jwt({ token, account, user }) {
        if (account) {
          token.accessToken = account.access_token;
          token.refreshToken = account.refresh_token ?? token.refreshToken;
          token.expiresAt =
            account.expires_at ?? Math.floor(Date.now() / 1000) + 3600;
          // Google providerAccountId is stable across sessions (unlike NextAuth's ephemeral user.id).
          token.sub = account.providerAccountId || user?.id || token.sub;
          token.error = undefined;

          // Persist tokens so the daily cron can sync without a browser session.
          if (token.sub && account.providerAccountId) {
            try {
              const canonicalUserId = await persistGoogleOAuthAccount({
                userId: String(token.sub),
                email: user?.email,
                name: user?.name,
                image: user?.image,
                providerAccountId: account.providerAccountId,
                accessToken: account.access_token,
                refreshToken: account.refresh_token,
                expiresAt: account.expires_at,
                tokenType: account.token_type,
                scope: account.scope,
                idToken: account.id_token,
              });
              if (canonicalUserId) token.sub = canonicalUserId;
            } catch (err) {
              console.error("Failed to persist Google OAuth account", err);
            }
          }

          return token;
        }
        const expiresAt = Number(token.expiresAt || 0) * 1000;
        if (token.accessToken && expiresAt > Date.now() + 60_000) {
          return token;
        }
        return refreshGoogleAccessToken(token);
      },
      async session({ session, token }) {
        if (session.user) {
          let userId = (token.sub as string) || "google-user";
          // Reconcile with DB when an older JWT sub no longer matches the email's User row.
          if (session.user.email) {
            try {
              const byEmail = await prisma.user.findUnique({
                where: { email: session.user.email },
                select: { id: true },
              });
              if (byEmail) userId = byEmail.id;
            } catch {
              // Postgres may be down during setup; keep JWT sub.
            }
          }
          session.user.id = userId;
        }
        session.accessToken = token.accessToken as string | undefined;
        session.error = token.error as string | undefined;
        return session;
      },
    },
    pages: {
      signIn: "/login",
      error: "/login",
    },
    trustHost: true,
  };
});
