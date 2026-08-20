import {
  attributionBucketKey,
  bucketHasSegmentation,
  normalizeCountry,
  normalizeDevice,
  normalizeHour,
} from "./bucket";
import { formatDateKey, normalizeLandingPage, toDateOnly } from "./normalize";
import {
  keywordPropensity,
  normalizePropensityShares,
  overallBucketConfidence,
  scoreAttributionConfidence,
  type ConfidenceBreakdown,
  type ConfidenceLevel,
} from "./propensity";
import { isGoogleOrganicForJoin } from "./source";

export type { ConfidenceBreakdown, ConfidenceLevel };

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
  conversionPage?: string | null;
  eventName: string;
  device?: string | null;
  country?: string | null;
  sessions: number;
  eventCount?: number;
  conversions: number;
  eventValue: number;
  channelGroup?: string;
  source?: string | null;
  isKeyEvent?: boolean;
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
  propensityShare: number;
  estimatedKeyEvents: number;
  estimatedValue: number;
  confidence: ConfidenceBreakdown;
};

export type QueryMappingBucket = {
  bucketId: string;
  date: string;
  hour: string | null;
  landingPage: string;
  device: string | null;
  country: string | null;
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
  journeys: Array<{
    conversionPage: string;
    eventName: string;
    conversions: number;
    eventValue: number;
    isMultiPage: boolean;
    label: string;
  }>;
  multiPageShare: number;
  keywords: MappedKeyword[];
  overallConfidence: number;
  overallConfidenceLevel: ConfidenceLevel;
  competitionLevel: "sole" | "light" | "crowded";
};

export type OtherEngineKeyEvent = {
  date: string;
  hour: string | null;
  landingPage: string;
  device: string | null;
  country: string | null;
  eventName: string;
  source: string;
  sessions: number;
  conversions: number;
};

const TRAFFIC_EVENTS = new Set(["session_start", "page_view", "first_visit"]);

function isOrganicSearch(channel?: string | null) {
  if (!channel) return true;
  return channel.trim().toLowerCase() === "organic search";
}

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

/** @deprecated use scoreAttributionConfidence from propensity */
export function scoreConfidence(params: {
  clickShare: number;
  keywordCount: number;
  keywordDevice: string | null;
  keywordCountry: string | null;
  ga4Devices: Record<string, number>;
  ga4Countries: Record<string, number>;
  ga4Sessions: number;
}): ConfidenceBreakdown {
  return scoreAttributionConfidence({
    propensityShare: params.clickShare,
    keywordCount: params.keywordCount,
    clicks: params.clickShare * 100,
    impressions: params.clickShare * 200,
    poolKeyEvents: params.ga4Sessions,
    poolSessions: params.ga4Sessions,
    segmentMatched: Boolean(params.keywordDevice && params.keywordCountry),
  });
}

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
      device: string | null;
      country: string | null;
      keywords: Map<string, GscAgg>;
    }
  >();

  for (const row of gscRows) {
    if (!(row.clicks > 0)) continue;
    const landingPage = normalizeLandingPage(row.page);
    const date = formatDateKey(toDateOnly(row.date));
    const hour = normalizeHour(row.hour);
    const device = normalizeDevice(row.device);
    const country = normalizeCountry(row.country);
    const key = attributionBucketKey({ date, hour, landingPage, device, country });
    const mutable = gscByBucket.get(key) ?? {
      date,
      hour,
      landingPage,
      device,
      country,
      keywords: new Map<string, GscAgg>(),
    };
    const q = row.query || "(anonymized)";
    const existing = mutable.keywords.get(q) ?? {
      clicks: 0,
      impressions: 0,
      ctrSum: 0,
      positionSum: 0,
      rows: 0,
      device,
      country,
    };
    existing.clicks += row.clicks || 0;
    existing.impressions += row.impressions || 0;
    existing.ctrSum += row.ctr || 0;
    existing.positionSum += row.position || 0;
    existing.rows += 1;
    if (!existing.device && device) existing.device = device;
    if (!existing.country && country) existing.country = country;
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
    trafficRows: Array<{ eventName: string; sessions: number }>;
  };
  const ga4ByBucket = new Map<string, Ga4Bucket>();

  for (const row of ga4Rows) {
    if (!isOrganicSearch(row.channelGroup)) continue;
    if (!(row.sessions > 0 || (row.conversions || 0) > 0 || (row.eventCount ?? 0) > 0)) continue;
    if (!isGoogleOrganicForJoin(row.source)) continue;

    const landingPage = normalizeLandingPage(row.landingPage);
    const conversionPage = normalizeLandingPage(row.conversionPage || row.landingPage);
    const date = formatDateKey(toDateOnly(row.date));
    const hour = normalizeHour(row.hour);
    const key = attributionBucketKey({
      date,
      hour,
      landingPage,
      device: row.device,
      country: row.country,
    });
    const agg: Ga4Bucket = ga4ByBucket.get(key) ?? {
      conversions: 0,
      eventValue: 0,
      sessions: 0,
      events: new Map(),
      journeys: new Map(),
      trafficRows: [],
    };
    agg.trafficRows.push({ eventName: row.eventName, sessions: row.sessions || 0 });

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
    if (totalClicks <= 0) continue;
    if (sessions <= 0 && keyEvents <= 0) continue;

    const segmentMatched = bucketHasSegmentation(bucketId);
    const propensityWeights = [...gsc.keywords.entries()].map(([keyword, stats]) => ({
      key: keyword,
      weight: keywordPropensity({
        clicks: stats.clicks,
        ctr: stats.rows > 0 ? stats.ctrSum / stats.rows : 0,
        position: stats.rows > 0 ? stats.positionSum / stats.rows : 0,
        impressions: stats.impressions,
      }),
    }));
    const propensityShares = normalizePropensityShares(propensityWeights);

    const keywords: MappedKeyword[] = [...gsc.keywords.entries()].map(([keyword, stats]) => {
      const clickShare = totalClicks > 0 ? stats.clicks / totalClicks : 0;
      const propensityShare = propensityShares.get(keyword) ?? clickShare;
      const confidence = scoreAttributionConfidence({
        propensityShare,
        keywordCount,
        clicks: stats.clicks,
        impressions: stats.impressions,
        poolKeyEvents: keyEvents,
        poolSessions: sessions,
        segmentMatched,
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
        propensityShare,
        estimatedKeyEvents: keyEvents * propensityShare,
        estimatedValue: eventValue * propensityShare,
        confidence,
      };
    });

    keywords.sort(
      (a, b) =>
        b.confidence.score - a.confidence.score ||
        b.estimatedKeyEvents - a.estimatedKeyEvents ||
        b.clicks - a.clicks,
    );

    const { score: overallConfidence, level: overallConfidenceLevel } =
      overallBucketConfidence(keywords);

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
      device: gsc.device,
      country: gsc.country,
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
      keywords,
      overallConfidence,
      overallConfidenceLevel,
      competitionLevel,
    });
  }

  return buckets.sort(
    (a, b) =>
      b.keyEvents - a.keyEvents ||
      b.overallConfidence - a.overallConfidence ||
      b.keywordCount - a.keywordCount ||
      b.totalClicks - a.totalClicks,
  );
}

export function collectOtherEngineKeyEvents(ga4Rows: Ga4MappingRow[]): OtherEngineKeyEvent[] {
  const out: OtherEngineKeyEvent[] = [];
  for (const row of ga4Rows) {
    if (!isOrganicSearch(row.channelGroup)) continue;
    const isKey = row.isKeyEvent ?? (row.conversions || 0) > 0;
    if (!isKey) continue;
    if (isGoogleOrganicForJoin(row.source)) continue;
    out.push({
      date: formatDateKey(toDateOnly(row.date)),
      hour: normalizeHour(row.hour),
      landingPage: normalizeLandingPage(row.landingPage),
      device: normalizeDevice(row.device),
      country: normalizeCountry(row.country),
      eventName: row.eventName,
      source: (row.source || "").trim() || "(not set)",
      sessions: row.sessions || 0,
      conversions: row.conversions || 0,
    });
  }
  return out.sort(
    (a, b) => b.conversions - a.conversions || a.eventName.localeCompare(b.eventName),
  );
}

export function summarizeMapping(
  buckets: QueryMappingBucket[],
  otherEngineEvents: OtherEngineKeyEvent[] = [],
) {
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
  const highConfBuckets = withEvents.filter((b) => b.overallConfidenceLevel === "high");

  return {
    bucketCount: buckets.length,
    bucketsWithKeyEvents: withEvents.length,
    crowdedBuckets: crowded.length,
    highConfidenceBuckets: highConfBuckets.length,
    highConfidenceMappings: highConfKeywords.length,
    mediumConfidenceMappings: mediumConfKeywords.length,
    lowConfidenceMappings: lowConfKeywords.length,
    totalSharedKeyEvents: withEvents.reduce((s, b) => s + b.keyEvents, 0),
    multiPageBuckets: withEvents.filter((b) => b.multiPageShare > 0).length,
    multiPageKeyEvents: withEvents.reduce(
      (s, b) => s + b.keyEvents * b.multiPageShare,
      0,
    ),
    otherEngineKeyEvents: otherEngineEvents.reduce((s, e) => s + e.conversions, 0),
    otherEngineEventCount: otherEngineEvents.length,
  };
}
