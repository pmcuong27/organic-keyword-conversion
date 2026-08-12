import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envFile = path.join(root, ".env");
const APP_DB = "gsc_ga4_blend";
const PRISMA_INSTANCE = "default";
const DOCKER_URL =
  "postgresql://blend:blend@localhost:5432/gsc_ga4_blend?schema=public";

function quoteEnv(value) {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function getEnvValue(text, key) {
  const match = text.match(new RegExp(`^${key}=(.*)$`, "m"));
  if (!match) return "";
  let value = match[1].trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1).replace(/\\"/g, '"');
  }
  return value;
}

function upsertEnv(key, value) {
  let text = existsSync(envFile) ? readFileSync(envFile, "utf8") : "";
  if (text.length && !text.endsWith("\n")) text += "\n";
  const line = `${key}=${quoteEnv(value)}`;
  const re = new RegExp(`^${key}=.*$`, "m");
  if (re.test(text)) text = text.replace(re, line);
  else text += `${line}\n`;
  writeFileSync(envFile, text, "utf8");
  process.env[key] = value;
}

function redact(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.hostname}:${parsed.port || "5432"}${parsed.pathname}`;
  } catch {
    return "(invalid DATABASE_URL)";
  }
}

async function canConnect(url) {
  if (!url) return false;
  const client = new pg.Client({
    connectionString: url,
    connectionTimeoutMillis: 2500,
  });
  try {
    await client.connect();
    await client.query("SELECT 1");
    return true;
  } catch {
    return false;
  } finally {
    try {
      await client.end();
    } catch {
      /* ignore */
    }
  }
}

function run(command, args, inherit = false) {
  return spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    shell: true,
    stdio: inherit ? "inherit" : "pipe",
    env: process.env,
  });
}

async function tryDocker() {
  const up = run("docker", ["compose", "up", "-d"]);
  if (up.status !== 0) return false;
  for (let i = 0; i < 30; i += 1) {
    if (await canConnect(DOCKER_URL)) return true;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

function startPrismaDev() {
  const result = run("npx", ["prisma", "dev", "--detach", `--name=${PRISMA_INSTANCE}`]);
  const out = `${result.stdout || ""}\n${result.stderr || ""}`;
  const match = out.match(/postgres(?:ql)?:\/\/[^\s]+/i);
  return match?.[0]?.trim() || null;
}

async function ensureAppDatabase(adminUrl) {
  const admin = new pg.Client({
    connectionString: adminUrl,
    connectionTimeoutMillis: 5000,
  });
  await admin.connect();
  try {
    const found = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [APP_DB]);
    if (!found.rowCount) {
      await admin.query(`CREATE DATABASE ${APP_DB}`);
    }
  } finally {
    await admin.end();
  }

  const parsed = new URL(adminUrl);
  parsed.pathname = `/${APP_DB}`;
  parsed.searchParams.set("schema", "public");
  if (!parsed.searchParams.get("sslmode")) parsed.searchParams.set("sslmode", "disable");
  return parsed.toString();
}

async function main() {
  const args = new Set(process.argv.slice(2));
  if (args.has("--down")) {
    run("docker", ["compose", "down"], true);
    run("npx", ["prisma", "dev", "stop", PRISMA_INSTANCE], true);
    return;
  }

  const envText = existsSync(envFile) ? readFileSync(envFile, "utf8") : "";
  const current = getEnvValue(envText, "DATABASE_URL");

  if (await canConnect(current)) {
    console.log(`Postgres already reachable at ${redact(current)}`);
    process.env.DATABASE_URL = current;
  } else if (await tryDocker()) {
    upsertEnv("DATABASE_URL", DOCKER_URL);
    console.log(`Postgres started with Docker at ${redact(DOCKER_URL)}`);
  } else {
    console.log("Docker is not available; starting local Prisma Postgres...");
    const adminUrl = startPrismaDev();
    if (!adminUrl) {
      throw new Error(
        "Could not start Postgres. Start Docker Desktop and retry, or run: npx prisma dev --detach",
      );
    }
    const appUrl = await ensureAppDatabase(adminUrl);
    if (!(await canConnect(appUrl))) {
      throw new Error(`Prisma Postgres started but ${APP_DB} is not reachable`);
    }
    upsertEnv("DATABASE_URL", appUrl);
    console.log(`Postgres started with prisma dev at ${redact(appUrl)}`);
  }

  if (!args.has("--no-push")) {
    const push = run("npx", ["prisma", "db", "push"], true);
    if (push.status !== 0) process.exit(push.status ?? 1);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
