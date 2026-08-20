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
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "localhost") parsed.hostname = "127.0.0.1";
    return parsed.toString();
  } catch {
    return url.replace(/@localhost(?=[:/])/i, "@127.0.0.1");
  }
}

const sql = `
ALTER TABLE "GscDailyMetric" ADD COLUMN IF NOT EXISTS "hour" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Ga4DailyMetric" ADD COLUMN IF NOT EXISTS "hour" TEXT NOT NULL DEFAULT '';
ALTER TABLE "KeywordAttribution" ADD COLUMN IF NOT EXISTS "hour" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Ga4DailyMetric" ADD COLUMN IF NOT EXISTS "eventCount" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Ga4DailyMetric" ADD COLUMN IF NOT EXISTS "isKeyEvent" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "GscDailyMetric" ADD COLUMN IF NOT EXISTS "device" TEXT NOT NULL DEFAULT '';
ALTER TABLE "GscDailyMetric" ADD COLUMN IF NOT EXISTS "country" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Ga4DailyMetric" ADD COLUMN IF NOT EXISTS "device" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Ga4DailyMetric" ADD COLUMN IF NOT EXISTS "country" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Ga4DailyMetric" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT '';
ALTER TABLE "KeywordAttribution" ADD COLUMN IF NOT EXISTS "device" TEXT NOT NULL DEFAULT '';
ALTER TABLE "KeywordAttribution" ADD COLUMN IF NOT EXISTS "country" TEXT NOT NULL DEFAULT '';
ALTER TABLE "KeywordAttribution" ADD COLUMN IF NOT EXISTS "propensityShare" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "KeywordAttribution" ADD COLUMN IF NOT EXISTS "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "KeywordAttribution" ADD COLUMN IF NOT EXISTS "confidenceLevel" TEXT NOT NULL DEFAULT 'low';

DO $$ BEGIN
  ALTER TABLE "GscDailyMetric" DROP CONSTRAINT IF EXISTS "GscDailyMetric_propertyId_date_query_page_key";
EXCEPTION WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "GscDailyMetric" DROP CONSTRAINT IF EXISTS "GscDailyMetric_propertyId_date_hour_query_page_key";
EXCEPTION WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Ga4DailyMetric" DROP CONSTRAINT IF EXISTS "Ga4DailyMetric_propertyId_date_landingPage_eventName_chann_key";
EXCEPTION WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Ga4DailyMetric" DROP CONSTRAINT IF EXISTS "Ga4DailyMetric_propertyId_date_hour_landingPage_eventName_channelGroup_key";
EXCEPTION WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "KeywordAttribution" DROP CONSTRAINT IF EXISTS "KeywordAttribution_propertyId_date_keyword_landingPage_key";
EXCEPTION WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "KeywordAttribution" DROP CONSTRAINT IF EXISTS "KeywordAttribution_propertyId_date_hour_keyword_landingPage_key";
EXCEPTION WHEN undefined_object THEN NULL; END $$;

DROP INDEX IF EXISTS "GscDailyMetric_propertyId_date_hour_query_page_key";
DROP INDEX IF EXISTS "Ga4DailyMetric_propertyId_date_hour_landingPage_eventName_channelGroup_key";
DROP INDEX IF EXISTS "Ga4DailyMetric_propertyId_date_hour_landingPage_eventName_channelGroup_device_country_key";
DROP INDEX IF EXISTS "KeywordAttribution_propertyId_date_hour_keyword_landingPage_key";

DO $$ DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'Ga4DailyMetric'
      AND c.contype = 'u'
      AND c.conname <> 'Ga4DailyMetric_grain_source_key'
  LOOP
    EXECUTE format('ALTER TABLE "Ga4DailyMetric" DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "GscDailyMetric_propertyId_date_hour_query_page_device_country_key"
  ON "GscDailyMetric"("propertyId", "date", "hour", "query", "page", "device", "country");

CREATE UNIQUE INDEX IF NOT EXISTS "Ga4DailyMetric_grain_source_key"
  ON "Ga4DailyMetric"("propertyId", "date", "hour", "landingPage", "eventName", "channelGroup", "device", "country", "source");

CREATE UNIQUE INDEX IF NOT EXISTS "KeywordAttribution_propertyId_date_hour_keyword_landingPage_device_country_key"
  ON "KeywordAttribution"("propertyId", "date", "hour", "keyword", "landingPage", "device", "country");

CREATE INDEX IF NOT EXISTS "Ga4DailyMetric_propertyId_isKeyEvent_idx"
  ON "Ga4DailyMetric"("propertyId", "isKeyEvent");
`;

const client = new pg.Client({ connectionString: databaseUrl() });
await client.connect();
await client.query(sql);
console.log("Segmentation columns and unique indexes are ready");
await client.end();
