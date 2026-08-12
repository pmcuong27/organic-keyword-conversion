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

export function isDatabaseConnectionError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  const code =
    typeof err === "object" && err && "code" in err
      ? String((err as { code?: string }).code)
      : "";
  return (
    /can't reach database|ECONNREFUSED|P1001|P1017|P1000|connection refused|timeout expired/i.test(
      message,
    ) || ["P1001", "P1017", "P1000"].includes(code)
  );
}

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaUrl?: string;
};

function createClient(url: string) {
  return new PrismaClient({
    datasources: url ? { db: { url } } : undefined,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

function getClient() {
  const url = readDatabaseUrl() || "";
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
