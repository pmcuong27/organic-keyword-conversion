import { isDatabaseConnectionError, prisma } from "@/lib/prisma";
import { ensureAppUser } from "@/lib/app-user";

export async function persistGoogleOAuthAccount(input: {
  userId: string;
  email?: string | null;
  name?: string | null;
  image?: string | null;
  providerAccountId: string;
  accessToken?: string | null;
  refreshToken?: string | null;
  expiresAt?: number | null;
  tokenType?: string | null;
  scope?: string | null;
  idToken?: string | null;
}): Promise<string | null> {
  try {
    // Stable Google subject is preferred; email match avoids duplicate User rows.
    const canonicalUserId = await ensureAppUser({
      id: input.providerAccountId || input.userId,
      email: input.email,
      name: input.name,
      image: input.image,
    });

    const existing = await prisma.account.findUnique({
      where: {
        provider_providerAccountId: {
          provider: "google",
          providerAccountId: input.providerAccountId,
        },
      },
    });

    await prisma.account.upsert({
      where: {
        provider_providerAccountId: {
          provider: "google",
          providerAccountId: input.providerAccountId,
        },
      },
      create: {
        userId: canonicalUserId,
        type: "oauth",
        provider: "google",
        providerAccountId: input.providerAccountId,
        access_token: input.accessToken ?? null,
        refresh_token: input.refreshToken ?? null,
        expires_at: input.expiresAt ?? null,
        token_type: input.tokenType ?? "Bearer",
        scope: input.scope ?? null,
        id_token: input.idToken ?? null,
      },
      update: {
        userId: canonicalUserId,
        access_token: input.accessToken ?? existing?.access_token ?? null,
        refresh_token: input.refreshToken ?? existing?.refresh_token ?? null,
        expires_at: input.expiresAt ?? existing?.expires_at ?? null,
        token_type: input.tokenType ?? existing?.token_type ?? "Bearer",
        scope: input.scope ?? existing?.scope ?? null,
        id_token: input.idToken ?? existing?.id_token ?? null,
      },
    });

    return canonicalUserId;
  } catch (err) {
    if (isDatabaseConnectionError(err)) {
      console.warn("Skipped Google token persist: Postgres is not reachable");
      return null;
    }
    throw err;
  }
}

async function refreshStoredAccessToken(refreshToken: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth client is not configured.");
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google token refresh failed: ${text}`);
  }

  return (await res.json()) as {
    access_token: string;
    expires_in?: number;
    refresh_token?: string;
  };
}

/** Background/cron path: use the stored Google Account refresh token. */
export async function getStoredGoogleAccessToken(userId: string): Promise<string> {
  const account = await prisma.account.findFirst({
    where: {
      provider: "google",
      OR: [{ userId }, { providerAccountId: userId }],
    },
    orderBy: { id: "asc" },
  });

  if (!account?.refresh_token && !account?.access_token) {
    throw new Error(
      "No stored Google credentials for automatic sync. Sign in once more to grant offline access.",
    );
  }

  const expiresAtMs = Number(account.expires_at || 0) * 1000;
  if (account.access_token && expiresAtMs > Date.now() + 60_000) {
    return account.access_token;
  }

  if (!account.refresh_token) {
    throw new Error(
      "Stored Google access token expired and no refresh token is available. Sign in again.",
    );
  }

  const refreshed = await refreshStoredAccessToken(account.refresh_token);
  const expiresAt = Math.floor(Date.now() / 1000) + (refreshed.expires_in ?? 3600);

  await prisma.account.update({
    where: { id: account.id },
    data: {
      access_token: refreshed.access_token,
      expires_at: expiresAt,
      refresh_token: refreshed.refresh_token ?? account.refresh_token,
    },
  });

  return refreshed.access_token;
}
