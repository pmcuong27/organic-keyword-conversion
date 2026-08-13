import { auth } from "@/auth";
import { getStoredGoogleAccessToken } from "@/lib/google-account";

export async function getGoogleAccessToken(userId?: string): Promise<string> {
  const session = await auth().catch(() => null);

  if (session?.error === "RefreshAccessTokenError" && !userId) {
    throw new Error("Google session expired. Sign out and sign in again.");
  }

  const sessionMatches =
    !!session?.accessToken &&
    session.error !== "RefreshAccessTokenError" &&
    (!userId || session.user?.id === userId);

  if (sessionMatches && session?.accessToken) {
    return session.accessToken;
  }

  const id = userId ?? session?.user?.id;
  if (!id) {
    throw new Error(
      "Google is not connected. Sign in again and grant Search Console and Analytics access.",
    );
  }

  try {
    return await getStoredGoogleAccessToken(id);
  } catch (err) {
    if (session?.accessToken && session.error !== "RefreshAccessTokenError") {
      return session.accessToken;
    }
    throw err;
  }
}
