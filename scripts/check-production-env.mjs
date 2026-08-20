import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/** Load KEY=VALUE pairs from a dotenv-style file into process.env (no override). */
function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  const text = readFileSync(filePath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(path.join(process.cwd(), ".env.production.local"));
loadEnvFile(path.join(process.cwd(), ".env.local"));
loadEnvFile(path.join(process.cwd(), ".env"));

/**
 * Fail fast when required production secrets are missing.
 * Run with: npm run check:prod-env
 */
const required = [
  "DATABASE_URL",
  "AUTH_SECRET",
  "AUTH_URL",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "CRON_SECRET",
];

const missing = [];
const warnings = [];

for (const key of required) {
  const value = (process.env[key] || "").trim();
  if (!value) missing.push(key);
}

const databaseUrl = (process.env.DATABASE_URL || "").trim();
if (databaseUrl) {
  const lower = databaseUrl.toLowerCase();
  if (
    lower.includes("localhost") ||
    lower.includes("127.0.0.1") ||
    lower.includes(":51214")
  ) {
    warnings.push(
      "DATABASE_URL points at a local host — use a managed TLS Postgres URL for production.",
    );
  }
  if (!/[?&]sslmode=require\b/i.test(databaseUrl) && !lower.includes("prisma.io")) {
    warnings.push(
      "DATABASE_URL should include sslmode=require (or a vendor TLS URL such as Prisma Postgres).",
    );
  }
}

const authUrl = (process.env.AUTH_URL || "").trim();
if (authUrl && !authUrl.startsWith("https://")) {
  warnings.push("AUTH_URL should be https://your-production-domain (no trailing slash).");
}

if (process.env.DEMO_MODE === "true") {
  warnings.push('DEMO_MODE is "true" — set DEMO_MODE=false for production.');
}

if (process.env.USE_OFFLINE_DB === "true") {
  warnings.push('USE_OFFLINE_DB is "true" — set USE_OFFLINE_DB=false for production.');
}

if (missing.length) {
  console.error("Missing required production environment variables:");
  for (const key of missing) console.error(`  - ${key}`);
  process.exit(1);
}

if (warnings.length) {
  console.warn("Production environment warnings:");
  for (const w of warnings) console.warn(`  - ${w}`);
} else {
  console.log("Production environment looks complete.");
}
