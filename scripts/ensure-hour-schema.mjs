import { readFileSync } from "node:fs";
import pg from "pg";

function databaseUrl() {
  const text = readFileSync(".env", "utf8");
  const match = text.match(/^DATABASE_URL=(.*)$/m);
  if (!match) throw new Error("DATABASE_URL missing from .env");
  let url = match[1].trim();
  if (
    (url.startsWith('"') && url.endsWith('"')) ||
    (url.startsWith("'") && url.endsWith("'"))
  ) {
    url = url.slice(1, -1);
  }
  return url;
}

const sql = `
ALTER TABLE "GscDailyMetric" ADD COLUMN IF NOT EXISTS "hour" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Ga4DailyMetric" ADD COLUMN IF NOT EXISTS "hour" TEXT NOT NULL DEFAULT '';
ALTER TABLE "KeywordAttribution" ADD COLUMN IF NOT EXISTS "hour" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Ga4DailyMetric" ADD COLUMN IF NOT EXISTS "eventCount" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Ga4DailyMetric" ADD COLUMN IF NOT EXISTS "isKeyEvent" BOOLEAN NOT NULL DEFAULT false;

DO $$ BEGIN
  ALTER TABLE "GscDailyMetric" DROP CONSTRAINT IF EXISTS "GscDailyMetric_propertyId_date_query_page_key";
EXCEPTION WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Ga4DailyMetric" DROP CONSTRAINT IF EXISTS "Ga4DailyMetric_propertyId_date_landingPage_eventName_chann_key";
EXCEPTION WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "KeywordAttribution" DROP CONSTRAINT IF EXISTS "KeywordAttribution_propertyId_date_keyword_landingPage_key";
EXCEPTION WHEN undefined_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "GscDailyMetric_propertyId_date_hour_query_page_key"
  ON "GscDailyMetric"("propertyId", "date", "hour", "query", "page");

CREATE UNIQUE INDEX IF NOT EXISTS "Ga4DailyMetric_propertyId_date_hour_landingPage_eventName_channelGroup_key"
  ON "Ga4DailyMetric"("propertyId", "date", "hour", "landingPage", "eventName", "channelGroup");

CREATE UNIQUE INDEX IF NOT EXISTS "KeywordAttribution_propertyId_date_hour_keyword_landingPage_key"
  ON "KeywordAttribution"("propertyId", "date", "hour", "keyword", "landingPage");

CREATE INDEX IF NOT EXISTS "Ga4DailyMetric_propertyId_isKeyEvent_idx"
  ON "Ga4DailyMetric"("propertyId", "isKeyEvent");
`;

const client = new pg.Client({ connectionString: databaseUrl() });
await client.connect();
await client.query(sql);
console.log("Hour columns and unique indexes are ready");
await client.end();
