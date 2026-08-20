import path from "path";
import type { Database as SqliteDatabase } from "better-sqlite3";
import type { Ga4Row, GscRow } from "./attribution";
import type { Ga4MappingRow, GscMappingRow } from "./query-mapping";
import { normalizeLandingPage } from "./normalize";

/** Default: sibling offline DB from the Python exporters */
export function resolveOfflineDbPath() {
  return (
    process.env.OFFLINE_DB_PATH ||
    path.resolve(process.cwd(), "..", "data", "gsc_offline.db")
  );
}

function openDb(): SqliteDatabase {
  let Database: new (
    filename: string,
    options?: { readonly?: boolean; fileMustExist?: boolean },
  ) => SqliteDatabase;
  try {
    // Optional native module — skip on Prisma Compute / Vercel (USE_OFFLINE_DB=false).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Database = require("better-sqlite3");
  } catch {
    throw new Error(
      "USE_OFFLINE_DB needs better-sqlite3. Locally run: npm i better-sqlite3. Cloud deploys should keep USE_OFFLINE_DB=false.",
    );
  }
  const dbPath = resolveOfflineDbPath();
  return new Database(dbPath, { readonly: true, fileMustExist: true });
}

/** GSC uses ISO-3166 alpha-3 (nzl); GA4 countryId is often alpha-2 (NZ). */
export function normalizeCountryCode(code: string | null | undefined): string | null {
  if (!code) return null;
  const c = code.trim().toUpperCase();
  const alpha3to2: Record<string, string> = {
    NZL: "NZ",
    AUS: "AU",
    USA: "US",
    GBR: "GB",
    CAN: "CA",
  };
  if (c.length === 3 && alpha3to2[c]) return alpha3to2[c];
  return c;
}

function normalizeDevice(device: string | null | undefined): string | null {
  if (!device) return null;
  const d = device.trim().toUpperCase();
  if (d.includes("MOBILE")) return "MOBILE";
  if (d.includes("TABLET")) return "TABLET";
  if (d.includes("DESKTOP")) return "DESKTOP";
  return d;
}

function hourFromUtc(hourUtc: string): { date: string; hour: string } {
  // 2026-08-11T04:00:00Z
  const date = hourUtc.slice(0, 10);
  const hour = hourUtc.slice(11, 13);
  return { date, hour };
}

export function readOfflineGscRows(fromKey: string, toKey: string): GscRow[] {
  const db = openDb();
  try {
    const rows = db
      .prepare(
        `
        SELECT hour_utc, query, page, page_path, device, country,
               clicks, impressions, ctr, position
        FROM gsc_hourly
        WHERE report_name = 'full'
          AND substr(hour_utc, 1, 10) >= ?
          AND substr(hour_utc, 1, 10) <= ?
        `,
      )
      .all(fromKey, toKey) as Array<{
      hour_utc: string;
      query: string | null;
      page: string | null;
      page_path: string | null;
      device: string | null;
      country: string | null;
      clicks: number;
      impressions: number;
      ctr: number;
      position: number;
    }>;

    return rows.map((r) => {
      const { date, hour } = hourFromUtc(r.hour_utc);
      return {
        date,
        hour,
        query: r.query || "",
        page: normalizeLandingPage(r.page_path || r.page || "/"),
        device: normalizeDevice(r.device),
        country: normalizeCountryCode(r.country),
        clicks: Number(r.clicks || 0),
        impressions: Number(r.impressions || 0),
        ctr: Number(r.ctr || 0),
        position: Number(r.position || 0),
      };
    });
  } finally {
    db.close();
  }
}

export function readOfflineGa4Rows(fromKey: string, toKey: string): Ga4Row[] {
  const db = openDb();
  try {
    const rows = db
      .prepare(
        `
        SELECT hour_utc, landing_page, landing_page_plus_query, device_category,
               country, channel_group, sessions, key_events, conversions, total_users
        FROM ga4_hourly
        WHERE report_name = 'organic_landing'
          AND substr(hour_utc, 1, 10) >= ?
          AND substr(hour_utc, 1, 10) <= ?
        `,
      )
      .all(fromKey, toKey) as Array<{
      hour_utc: string;
      landing_page: string;
      landing_page_plus_query: string | null;
      device_category: string | null;
      country: string | null;
      channel_group: string | null;
      sessions: number;
      key_events: number;
      conversions: number;
      total_users: number;
    }>;

    return rows.map((r) => {
      const { date, hour } = hourFromUtc(r.hour_utc);
      const landing = normalizeLandingPage(r.landing_page || r.landing_page_plus_query || "/");
      const keyEvents = Number(r.key_events || r.conversions || 0);
      return {
        date,
        hour,
        landingPage: landing,
        // Offline grain has no event pagePath yet — treat as on-landing until journey sync exists
        conversionPage: landing,
        eventName: keyEvents > 0 ? "key_event" : "session",
        device: normalizeDevice(r.device_category),
        country: normalizeCountryCode(r.country),
        sessions: Number(r.sessions || 0),
        eventCount: keyEvents > 0 ? keyEvents : Number(r.sessions || 0),
        conversions: keyEvents,
        eventValue: keyEvents * 100,
        channelGroup: r.channel_group || "Organic Search",
        isKeyEvent: keyEvents > 0,
      };
    });
  } finally {
    db.close();
  }
}

export function readOfflineMappingSources(fromKey: string, toKey: string): {
  gsc: GscMappingRow[];
  ga4: Ga4MappingRow[];
} {
  const gsc = readOfflineGscRows(fromKey, toKey).map((r) => ({
    date: r.date,
    hour: r.hour,
    query: r.query,
    page: r.page,
    device: r.device,
    country: r.country,
    clicks: r.clicks,
    impressions: r.impressions,
    ctr: r.ctr,
    position: r.position,
  }));

  const ga4 = readOfflineGa4Rows(fromKey, toKey).map((r) => ({
    date: r.date,
    hour: r.hour,
    landingPage: r.landingPage,
    conversionPage: r.conversionPage,
    eventName: r.eventName,
    device: r.device,
    country: r.country,
    sessions: r.sessions,
    eventCount: r.eventCount ?? r.conversions,
    conversions: r.conversions,
    eventValue: r.eventValue,
    channelGroup: r.channelGroup,
    isKeyEvent: r.isKeyEvent ?? r.conversions > 0,
  }));

  return { gsc, ga4 };
}

export function readOfflineLastSyncedAt(): Date | null {
  try {
    const db = openDb();
    try {
      const row = db
        .prepare(
          `
          SELECT MAX(ts) AS ts FROM (
            SELECT MAX(fetched_at) AS ts FROM gsc_hourly
            UNION ALL
            SELECT MAX(fetched_at) AS ts FROM ga4_hourly
          )
          `,
        )
        .get() as { ts: string | null } | undefined;
      return row?.ts ? new Date(row.ts) : null;
    } finally {
      db.close();
    }
  } catch {
    return null;
  }
}

export function offlineDbStats() {
  try {
    const db = openDb();
    try {
      const gsc = db
        .prepare(
          "SELECT COUNT(*) AS n, MIN(hour_utc) AS min_h, MAX(hour_utc) AS max_h FROM gsc_hourly WHERE report_name='full'",
        )
        .get() as { n: number; min_h: string | null; max_h: string | null };
      const ga4 = db
        .prepare(
          "SELECT COUNT(*) AS n, MIN(hour_utc) AS min_h, MAX(hour_utc) AS max_h FROM ga4_hourly",
        )
        .get() as { n: number; min_h: string | null; max_h: string | null };
      return {
        gscRows: gsc.n,
        ga4Rows: ga4.n,
        gscRange: { min: gsc.min_h, max: gsc.max_h },
        ga4Range: { min: ga4.min_h, max: ga4.max_h },
      };
    } finally {
      db.close();
    }
  } catch {
    return { error: "Offline database is missing or unreadable." };
  }
}

export type OfflineDbStats = ReturnType<typeof offlineDbStats>;
