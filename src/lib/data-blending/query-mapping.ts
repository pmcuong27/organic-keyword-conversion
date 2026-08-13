import { formatDateKey, normalizeLandingPage, toDateOnly } from "./normalize";

export type GscMappingRow = {
  date: string;
  hour?: string | null;
  query: string;
  page: string;
  device?: string | null;
  country?: string | null;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type Ga4MappingRow = {
  date: string;
  hour?: string | null;
  landingPage: string;
  /** Event-scoped page where key event fired (thank-you, contact, etc.) */
  conversionPage?: string | null;
  eventName: string;
  device?: string | null;
  country?: string | null;
  sessions: number;
  eventCount?: number;
  conversions: number;
  eventValue: number;
  channelGroup?: string;
  isKeyEvent?: boolean;
};

export type ConfidenceLevel = "high" | "medium" | "low";

export type ConfidenceBreakdown = {
  clickShare: number;
  uniqueness: number;
  deviceOverlap: number;
  countryOverlap: number;
  score: number;
  level: ConfidenceLevel;
};

export type MappedKeyword = {
  keyword: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  device: string | null;
  country: string | null;
  clickShare: number;
  estimatedKeyEvents: number;
  estimatedValue: number;
  confidence: ConfidenceBreakdown;
};

export type QueryMappingBucket = {
  bucketId: string;
  date: string;
  hour: string | null;
  landingPage: string;
  keywordCount: number;
  totalClicks: number;
  totalImpressions: number;
  keyEvents: number;
  eventValue: number;
  sessions: number;
  eventBreakdown: Array<{
    eventName: string;
    conversions: number;
    eventValue: number;
    conversionPage?: string;
  }>;
  /**
   * Distinct conversion journeys for this landing×hour bucket.
   * Example: /features → /thank-you (generate_lead)
   */
  journeys: Array<{
    conversionPage: string;
    eventName: string;
    conversions: number;
    eventValue: number;
    isMultiPage: boolean;
    label: string;
  }>;
  multiPageShare: number;
  ga4Devices: Record<string, number>;
  ga4Countries: Record<string, number>;
  keywords: MappedKeyword[];
  avgConfidence: number;
  competitionLevel: "sole" | "light" | "crowded";
};

function normalizeHour(hour?: string | null): string | null {
  if (hour === undefined || hour === null || hour === "") return null;
  const n = Number(hour);
  if (Number.isFinite(n)) {
    return String(Math.max(0, Math.min(23, Math.floor(n)))).padStart(2, "0");
  }
  return hour.slice(0, 2).padStart(2, "0");
}

function normalizeDevice(device?: string | null): string | null {
  if (!device) return null;
  const d = device.trim().toUpperCase();
  if (d === "DESKTOP" || d === "MOBILE" || d === "TABLET") return d;
  if (d === "DESKTOP".toLowerCase() || d.includes("DESKTOP")) return "DESKTOP";
  if (d.includes("MOBILE")) return "MOBILE";
  if (d.includes("TABLET")) return "TABLET";
  return d;
}

function normalizeCountry(country?: string | null): string | null {
  if (!country) return null;
  return country.trim().toUpperCase();
}

function bucketKey(date: string, hour: string | null, landingPage: string) {
  return `${date}::${hour ?? "all"}::${landingPage}`;
}

function isOrganicSearch(channel?: string | null) {
  if (!channel) return true;
  return channel.trim().toLowerCase() === "organic search";
}

const TRAFFIC_EVENTS = new Set(["session_start", "page_view", "first_visit"]);

/** Organic visitor count for a landing×hour. Do not sum sessions across event names. */
function organicUserTraffic(
  rows: Array<{ eventName: string; sessions: number }>,
): number {
  let preferred = 0;
  let maxSessions = 0;
  for (const row of rows) {
    const sessions = row.sessions || 0;
    if (sessions > maxSessions) maxSessions = sessions;
    if (TRAFFIC_EVENTS.has((row.eventName || "").toLowerCase()) && sessions > preferred) {
      preferred = sessions;
    }
  }
  return preferred > 0 ? preferred : maxSessions;
}

function distributionOverlap(
  weight: number,
  key: string | null,
  dist: Record<string, number>,
  total: number,
): number {
  if (!key || total <= 0) return 0.35; // unknown → neutral prior
  const share = (dist[key] ?? 0) / total;
  // Blend absolute presence with share strength
  return Math.min(1, share * 0.7 + (share > 0 ? 0.3 : 0));
}

/**
 * Confidence that a keyword caused a share of key events in a page×hour bucket.
 * Not a session join — GSC has no session/cookie IDs to match GA4.
 *
 * score = 0.45*clickShare + 0.25*uniqueness + 0.15*deviceOverlap + 0.15*countryOverlap
 */
export function scoreConfidence(params: {
  clickShare: number;
  keywordCount: number;
  keywordDevice: string | null;
  keywordCountry: string | null;
  ga4Devices: Record<string, number>;
  ga4Countries: Record<string, number>;
  ga4Sessions: number;
}): ConfidenceBreakdown {
  const clickShare = Math.max(0, Math.min(1, params.clickShare));
  // 1 keyword → 1.0; 5 keywords → ~0.2; asymptotic
  const uniqueness = params.keywordCount <= 1 ? 1 : 1 / Math.sqrt(params.keywordCount);
  const deviceOverlap = distributionOverlap(
    clickShare,
    params.keywordDevice,
    params.ga4Devices,
    params.ga4Sessions,
  );
  const countryOverlap = distributionOverlap(
    clickShare,
    params.keywordCountry,
    params.ga4Countries,
    params.ga4Sessions,
  );

  const score =
    0.45 * clickShare +
    0.25 * uniqueness +
    0.15 * deviceOverlap +
    0.15 * countryOverlap;

  const level: ConfidenceLevel =
    score >= 0.7 ? "high" : score >= 0.4 ? "medium" : "low";

  return {
    clickShare,
    uniqueness,
    deviceOverlap,
    countryOverlap,
    score,
    level,
  };
}

/**
 * Build query→key-event mapping buckets for landing-page × hour windows.
 * A bucket is emitted only when Search Console recorded at least one click and
 * GA4 recorded Organic Search user traffic on that same landing page in the
 * same hour. Keywords without clicks are excluded. This is not a visitor-level
 * join — GSC and GA4 share no session or cookie id.
 */
export function buildQueryMappingAnalysis(
  gscRows: GscMappingRow[],
  ga4Rows: Ga4MappingRow[],
): QueryMappingBucket[] {
  type GscAgg = {
    clicks: number;
    impressions: number;
    ctrSum: number;
    positionSum: number;
    rows: number;
    device: string | null;
    country: string | null;
  };

  const gscByBucket = new Map<
    string,
    {
      date: string;
      hour: string | null;
      landingPage: string;
      keywords: Map<string, GscAgg>;
    }
  >();

  for (const row of gscRows) {
    if (!(row.clicks > 0)) continue;
    const landingPage = normalizeLandingPage(row.page);
    const date = formatDateKey(toDateOnly(row.date));
    const hour = normalizeHour(row.hour);
    const key = bucketKey(date, hour, landingPage);
    const mutable = gscByBucket.get(key) ?? {
      date,
      hour,
      landingPage,
      keywords: new Map<string, GscAgg>(),
    };
    const q = row.query || "(anonymized)";
    const existing = mutable.keywords.get(q) ?? {
      clicks: 0,
      impressions: 0,
      ctrSum: 0,
      positionSum: 0,
      rows: 0,
      device: normalizeDevice(row.device),
      country: normalizeCountry(row.country),
    };
    existing.clicks += row.clicks || 0;
    existing.impressions += row.impressions || 0;
    existing.ctrSum += row.ctr || 0;
    existing.positionSum += row.position || 0;
    existing.rows += 1;
    // Prefer non-null device/country when aggregating dimension splits
    if (!existing.device && row.device) existing.device = normalizeDevice(row.device);
    if (!existing.country && row.country) existing.country = normalizeCountry(row.country);
    mutable.keywords.set(q, existing);
    gscByBucket.set(key, mutable);
  }

  type Ga4Bucket = {
    conversions: number;
    eventValue: number;
    sessions: number;
    events: Map<
      string,
      { conversions: number; eventValue: number; conversionPage: string }
    >;
    journeys: Map<
      string,
      { conversionPage: string; eventName: string; conversions: number; eventValue: number }
    >;
    devices: Record<string, number>;
    countries: Record<string, number>;
    trafficRows: Array<{ eventName: string; sessions: number }>;
  };
  const ga4ByBucket = new Map<string, Ga4Bucket>();

  for (const row of ga4Rows) {
    if (!isOrganicSearch(row.channelGroup)) continue;
    if (!(row.sessions > 0 || (row.conversions || 0) > 0 || (row.eventCount ?? 0) > 0)) continue;

    const landingPage = normalizeLandingPage(row.landingPage);
    const conversionPage = normalizeLandingPage(row.conversionPage || row.landingPage);
    const date = formatDateKey(toDateOnly(row.date));
    const hour = normalizeHour(row.hour);
    // Join on session landing page × hour, never on conversion/thank-you page
    const key = bucketKey(date, hour, landingPage);
    const agg = ga4ByBucket.get(key) ?? {
      conversions: 0,
      eventValue: 0,
      sessions: 0,
      events: new Map(),
      journeys: new Map(),
      devices: {} as Record<string, number>,
      countries: {} as Record<string, number>,
      trafficRows: [],
    };
    agg.trafficRows.push({ eventName: row.eventName, sessions: row.sessions || 0 });

    const device = normalizeDevice(row.device);
    if (device) agg.devices[device] = (agg.devices[device] ?? 0) + (row.sessions || 0);
    const country = normalizeCountry(row.country);
    if (country) agg.countries[country] = (agg.countries[country] ?? 0) + (row.sessions || 0);

    const isKey = row.isKeyEvent ?? (row.conversions || 0) > 0;
    if (isKey) {
      agg.conversions += row.conversions || 0;
      agg.eventValue += row.eventValue || 0;
      const ev = agg.events.get(row.eventName) ?? {
        conversions: 0,
        eventValue: 0,
        conversionPage,
      };
      ev.conversions += row.conversions || 0;
      ev.eventValue += row.eventValue || 0;
      if (conversionPage !== landingPage) ev.conversionPage = conversionPage;
      agg.events.set(row.eventName, ev);

      const journeyKey = `${conversionPage}::${row.eventName}`;
      const journey = agg.journeys.get(journeyKey) ?? {
        conversionPage,
        eventName: row.eventName,
        conversions: 0,
        eventValue: 0,
      };
      journey.conversions += row.conversions || 0;
      journey.eventValue += row.eventValue || 0;
      agg.journeys.set(journeyKey, journey);
    }

    ga4ByBucket.set(key, agg);
  }

  for (const agg of ga4ByBucket.values()) {
    agg.sessions = organicUserTraffic(agg.trafficRows);
  }

  const buckets: QueryMappingBucket[] = [];

  for (const [bucketId, gsc] of gscByBucket.entries()) {
    const ga4 = ga4ByBucket.get(bucketId);
    const keywordCount = gsc.keywords.size;
    const totalClicks = [...gsc.keywords.values()].reduce((s, k) => s + k.clicks, 0);
    const totalImpressions = [...gsc.keywords.values()].reduce(
      (s, k) => s + k.impressions,
      0,
    );
    const keyEvents = ga4?.conversions ?? 0;
    const eventValue = ga4?.eventValue ?? 0;
    const sessions = ga4?.sessions ?? 0;
    if (totalClicks <= 0 || sessions <= 0) continue;

    const keywords: MappedKeyword[] = [...gsc.keywords.entries()].map(([keyword, stats]) => {
      const clickShare = totalClicks > 0 ? stats.clicks / totalClicks : 0;
      const confidence = scoreConfidence({
        clickShare,
        keywordCount,
        keywordDevice: stats.device,
        keywordCountry: stats.country,
        ga4Devices: ga4?.devices ?? {},
        ga4Countries: ga4?.countries ?? {},
        ga4Sessions: sessions || 1,
      });

      return {
        keyword,
        clicks: stats.clicks,
        impressions: stats.impressions,
        ctr: stats.rows > 0 ? stats.ctrSum / stats.rows : 0,
        position: stats.rows > 0 ? stats.positionSum / stats.rows : 0,
        device: stats.device,
        country: stats.country,
        clickShare,
        estimatedKeyEvents: keyEvents * clickShare,
        estimatedValue: eventValue * clickShare,
        confidence,
      };
    });

    keywords.sort(
      (a, b) =>
        b.confidence.score - a.confidence.score ||
        b.estimatedKeyEvents - a.estimatedKeyEvents ||
        b.clicks - a.clicks,
    );

    const avgConfidence =
      keywords.length > 0
        ? keywords.reduce((s, k) => s + k.confidence.score, 0) / keywords.length
        : 0;

    const competitionLevel: QueryMappingBucket["competitionLevel"] =
      keywordCount <= 1 ? "sole" : keywordCount <= 3 ? "light" : "crowded";

    const journeys = ga4
      ? [...ga4.journeys.values()]
          .map((j) => {
            const isMultiPage = j.conversionPage !== gsc.landingPage;
            return {
              conversionPage: j.conversionPage,
              eventName: j.eventName,
              conversions: j.conversions,
              eventValue: j.eventValue,
              isMultiPage,
              label: isMultiPage
                ? `${gsc.landingPage} → ${j.conversionPage}`
                : gsc.landingPage,
            };
          })
          .sort((a, b) => b.conversions - a.conversions)
      : [];

    const multiPageConversions = journeys
      .filter((j) => j.isMultiPage)
      .reduce((s, j) => s + j.conversions, 0);
    const multiPageShare = keyEvents > 0 ? multiPageConversions / keyEvents : 0;

    buckets.push({
      bucketId,
      date: gsc.date,
      hour: gsc.hour,
      landingPage: gsc.landingPage,
      keywordCount,
      totalClicks,
      totalImpressions,
      keyEvents,
      eventValue,
      sessions,
      eventBreakdown: ga4
        ? [...ga4.events.entries()]
            .map(([eventName, v]) => ({
              eventName,
              conversions: v.conversions,
              eventValue: v.eventValue,
              conversionPage: v.conversionPage,
            }))
            .sort((a, b) => b.conversions - a.conversions)
        : [],
      journeys,
      multiPageShare,
      ga4Devices: ga4?.devices ?? {},
      ga4Countries: ga4?.countries ?? {},
      keywords,
      avgConfidence,
      competitionLevel,
    });
  }

  return buckets.sort(
    (a, b) =>
      b.keyEvents - a.keyEvents ||
      b.keywordCount - a.keywordCount ||
      b.totalClicks - a.totalClicks,
  );
}

export function summarizeMapping(buckets: QueryMappingBucket[]) {
  const withEvents = buckets.filter((b) => b.keyEvents > 0);
  const crowded = withEvents.filter((b) => b.competitionLevel === "crowded");
  const highConfKeywords = withEvents.flatMap((b) =>
    b.keywords.filter((k) => k.confidence.level === "high"),
  );
  const mediumConfKeywords = withEvents.flatMap((b) =>
    b.keywords.filter((k) => k.confidence.level === "medium"),
  );
  const lowConfKeywords = withEvents.flatMap((b) =>
    b.keywords.filter((k) => k.confidence.level === "low"),
  );

  return {
    bucketCount: buckets.length,
    bucketsWithKeyEvents: withEvents.length,
    crowdedBuckets: crowded.length,
    highConfidenceMappings: highConfKeywords.length,
    mediumConfidenceMappings: mediumConfKeywords.length,
    lowConfidenceMappings: lowConfKeywords.length,
    totalSharedKeyEvents: withEvents.reduce((s, b) => s + b.keyEvents, 0),
    multiPageBuckets: withEvents.filter((b) => b.multiPageShare > 0).length,
    multiPageKeyEvents: withEvents.reduce(
      (s, b) => s + b.keyEvents * b.multiPageShare,
      0,
    ),
  };
}
