"use server";

import { revalidatePath } from "next/cache";
import { generateAuthSecret, getOauthPublicConfig, saveOauthEnv } from "@/lib/oauth-env";

export async function getOauthSettings() {
  return getOauthPublicConfig();
}

export async function generateAuthSecretAction() {
  return generateAuthSecret();
}

export async function saveOauthSettings(formData: FormData) {
  const authUrl = String(formData.get("authUrl") || "");
  const authSecret = String(formData.get("authSecret") || "");
  const googleClientId = String(formData.get("googleClientId") || "");
  const googleClientSecret = String(formData.get("googleClientSecret") || "");

  if (!googleClientId) {
    return { ok: false as const, error: "Google client ID is required." };
  }

  const current = getOauthPublicConfig();
  if (!googleClientSecret && !current.googleClientSecretSet) {
    return { ok: false as const, error: "Google client secret is required." };
  }

  saveOauthEnv({
    authUrl,
    authSecret: authSecret || undefined,
    googleClientId,
    googleClientSecret: googleClientSecret || undefined,
    enableLiveGoogle: String(formData.get("enableLiveGoogle") || "") === "on",
  });

  revalidatePath("/", "layout");
  revalidatePath("/login");
  revalidatePath("/setup");
  revalidatePath("/dashboard/settings");
  return { ok: true as const };
}
