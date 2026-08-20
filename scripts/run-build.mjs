import { spawnSync } from "node:child_process";

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: process.env,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const databaseUrl = (process.env.DATABASE_URL || "").trim();
const skipMigrate = process.env.SKIP_MIGRATE === "true";

run("npx", ["prisma", "generate"]);

if (databaseUrl && !skipMigrate) {
  console.log("DATABASE_URL is set — running prisma migrate deploy");
  run("npx", ["prisma", "migrate", "deploy"]);
} else {
  console.log(
    "Skipping prisma migrate deploy (no DATABASE_URL or SKIP_MIGRATE=true). Run npm run db:migrate against production after the database is linked.",
  );
}

run("npx", ["next", "build"]);
