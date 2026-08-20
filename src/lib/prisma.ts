import { PrismaClient } from "@prisma/client";
import { existsSync, readFileSync } from "fs";
import path from "path";

function parseEnvValue(raw: string) {
  let value = raw.trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1).replace(/\\"/g, '"');
  }
  return value;
}

export function readDatabaseUrl() {
  const file = path.join(process.cwd(), ".env");
  if (existsSync(file)) {
    const match = readFileSync(file, "utf8").match(/^DATABASE_URL=(.*)$/m);
    if (match?.[1]) {
      const fromFile = parseEnvValue(match[1]);
      if (fromFile) return fromFile;
    }
  }
  return process.env.DATABASE_URL;
}

/** Prisma Postgres on Windows often binds IPv4 only; Node resolves localhost to ::1. */
function preferIpv4Host(url: string) {
  if (!url) return url;
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "localhost") parsed.hostname = "127.0.0.1";
    return parsed.toString();
  } catch {
    return url.replace(/@localhost(?=[:/])/i, "@127.0.0.1");
  }
}

/** Prisma Postgres / PgBouncer reuse connections; named prepared statements then collide. */
export function withPoolParams(url: string) {
  if (!url) return url;
  try {
    const parsed = new URL(preferIpv4Host(url));
    parsed.searchParams.set("pgbouncer", "true");
    const limit = Number(parsed.searchParams.get("connection_limit") || "10");
    if (!Number.isFinite(limit) || limit > 5) {
      parsed.searchParams.set("connection_limit", "5");
    }
    const connectTimeout = parsed.searchParams.get("connect_timeout");
    if (!connectTimeout || connectTimeout === "0") {
      parsed.searchParams.set("connect_timeout", "10");
    }
    return parsed.toString();
  } catch {
    const ipv4 = preferIpv4Host(url);
    if (/[?&]pgbouncer=/i.test(ipv4)) return ipv4;
    return `${ipv4}${ipv4.includes("?") ? "&" : "?"}pgbouncer=true`;
  }
}

function isPreparedStatementCollision(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return /42P05|prepared statement .+ already exists/i.test(message);
}

export function isDatabaseConnectionError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  const code =
    typeof err === "object" && err && "code" in err
      ? String((err as { code?: string }).code)
      : "";
  return (
    /can't reach database|ECONNREFUSED|ECONNRESET|P1001|P1017|P1000|connection refused|timeout expired/i.test(
      message,
    ) || ["P1001", "P1017", "P1000"].includes(code)
  );
}

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaUrl?: string;
};

function createClient(url: string) {
  const client = new PrismaClient({
    datasources: url ? { db: { url: withPoolParams(url) } } : undefined,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

  return client.$extends({
    query: {
      async $allOperations({ args, query }) {
        let lastErr: unknown;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            return await query(args);
          } catch (err) {
            lastErr = err;
            const retry =
              isPreparedStatementCollision(err) ||
              (isDatabaseConnectionError(err) && attempt < 2);
            if (!retry) throw err;
            await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
          }
        }
        throw lastErr;
      },
    },
  }) as unknown as PrismaClient;
}

function getClient() {
  const url = withPoolParams(readDatabaseUrl() || "");
  if (!globalForPrisma.prisma || globalForPrisma.prismaUrl !== url) {
    void globalForPrisma.prisma?.$disconnect();
    globalForPrisma.prisma = createClient(url);
    globalForPrisma.prismaUrl = url;
  }
  return globalForPrisma.prisma;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getClient();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
