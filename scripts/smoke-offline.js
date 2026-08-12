/**
 * Smoke-test offline blend without starting Next.
 * Run: node --experimental-strip-types (or via tsx) — use compiled JS require path.
 */
const path = require("path");

// Force env before requiring modules that read process.env at call time
process.env.DEMO_MODE = "false";
process.env.USE_OFFLINE_DB = "true";
process.env.OFFLINE_DB_PATH = path.resolve(
  __dirname,
  "..",
  "..",
  "data",
  "gsc_offline.db",
);

async function main() {
  // Dynamic import of TS via next isn't available; duplicate light check with better-sqlite3
  const Database = require("better-sqlite3");
  const db = new Database(process.env.OFFLINE_DB_PATH, {
    readonly: true,
    fileMustExist: true,
  });
  const gsc = db
    .prepare(
      "SELECT COUNT(*) AS n FROM gsc_hourly WHERE report_name='full' AND substr(hour_utc,1,10) >= ? AND substr(hour_utc,1,10) <= ?",
    )
    .get("2026-08-01", "2026-08-31");
  const ga4 = db
    .prepare(
      "SELECT COUNT(*) AS n, SUM(key_events) AS ke FROM ga4_hourly WHERE substr(hour_utc,1,10) >= ? AND substr(hour_utc,1,10) <= ?",
    )
    .get("2026-08-01", "2026-08-31");
  const sample = db
    .prepare(
      "SELECT query, page_path, clicks FROM gsc_hourly WHERE report_name='full' AND clicks > 0 ORDER BY clicks DESC LIMIT 5",
    )
    .all();
  console.log(
    JSON.stringify(
      {
        mode: "offline-db",
        gscInRange: gsc.n,
        ga4InRange: ga4.n,
        keyEventsSum: ga4.ke,
        topQueries: sample,
      },
      null,
      2,
    ),
  );
  db.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
