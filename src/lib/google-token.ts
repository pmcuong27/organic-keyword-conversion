import { auth } from "@/auth";

export async function getGoogleAccessToken(_userId?: string): Promise<string> {
  const session = await auth();
  if (session?.error === "RefreshAccessTokenError") {
    throw new Error("Google session expired. Sign out and sign in again.");
  }
  if (session?.accessToken) {
    return session.accessToken;
  }
  throw new Error(
    "Google is not connected. Sign in again and grant Search Console and Analytics access.",
  );
}
