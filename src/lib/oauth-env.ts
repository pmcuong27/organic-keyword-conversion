import { randomBytes } from "crypto";
import { existsSync, readFileSync, writeFileSync } from "fs";
import path from "path";

export type OauthPublicConfig = {
  authUrl: string;
  authSecretSet: boolean;
  googleClientId: string;
  googleClientSecretSet: boolean;
  redirectUri: string;
  configured: boolean;
};

function envPath() {
  return path.join(process.cwd(), ".env");
}

export function generateAuthSecret() {
  return randomBytes(32).toString("base64url");
}

export function getOauthPublicConfig(): OauthPublicConfig {
  const authUrl = (process.env.AUTH_URL || "http://localhost:3000").replace(/\/$/, "");
  const googleClientId = process.env.GOOGLE_CLIENT_ID || "";
  return {
    authUrl,
    authSecretSet: Boolean(process.env.AUTH_SECRET),
    googleClientId,
    googleClientSecretSet: Boolean(process.env.GOOGLE_CLIENT_SECRET),
    redirectUri: `${authUrl}/api/auth/callback/google`,
    configured: Boolean(googleClientId && process.env.GOOGLE_CLIENT_SECRET),
  };
}

function quoteEnv(value: string) {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export function saveOauthEnv(input: {
  authUrl: string;
  authSecret?: string;
  googleClientId: string;
  googleClientSecret?: string;
  enableLiveGoogle?: boolean;
}) {
  const authUrl = input.authUrl.trim().replace(/\/$/, "") || "http://localhost:3000";
  const googleClientId = input.googleClientId.trim();
  const authSecret = input.authSecret?.trim() || process.env.AUTH_SECRET || generateAuthSecret();
  const googleClientSecret =
    input.googleClientSecret?.trim() || process.env.GOOGLE_CLIENT_SECRET || "";

  const updates: Record<string, string> = {
    AUTH_URL: authUrl,
    AUTH_SECRET: authSecret,
    GOOGLE_CLIENT_ID: googleClientId,
    GOOGLE_CLIENT_SECRET: googleClientSecret,
  };

  if (input.enableLiveGoogle) {
    updates.DEMO_MODE = "false";
    updates.USE_OFFLINE_DB = "false";
  }

  const file = envPath();
  let text = existsSync(file) ? readFileSync(file, "utf8") : "";
  if (text.length && !text.endsWith("\n")) text += "\n";

  for (const [key, value] of Object.entries(updates)) {
    const line = `${key}=${quoteEnv(value)}`;
    const re = new RegExp(`^${key}=.*$`, "m");
    if (re.test(text)) text = text.replace(re, line);
    else text += `${line}\n`;
    process.env[key] = value;
  }

  writeFileSync(file, text, "utf8");
  return getOauthPublicConfig();
}
