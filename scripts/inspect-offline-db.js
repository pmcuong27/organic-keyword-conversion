const Database = require("better-sqlite3");
const path = require("path");

const dbPath =
  process.env.OFFLINE_DB_PATH ||
  path.resolve(__dirname, "..", "..", "data", "gsc_offline.db");

const db = new Database(dbPath, { readonly: true, fileMustExist: true });
const gsc = db
  .prepare("SELECT COUNT(*) AS n FROM gsc_hourly WHERE report_name = 'full'")
  .get();
const ga4 = db.prepare("SELECT COUNT(*) AS n FROM ga4_hourly").get();
const gscRange = db
  .prepare(
    "SELECT MIN(hour_utc) AS min_h, MAX(hour_utc) AS max_h FROM gsc_hourly WHERE report_name = 'full'",
  )
  .get();
const ga4Range = db
  .prepare("SELECT MIN(hour_utc) AS min_h, MAX(hour_utc) AS max_h FROM ga4_hourly")
  .get();

console.log(
  JSON.stringify(
    {
      dbPath,
      gscRows: gsc.n,
      ga4Rows: ga4.n,
      gscRange,
      ga4Range,
    },
    null,
    2,
  ),
);
db.close();
