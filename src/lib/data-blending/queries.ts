import { isDatabaseConnectionError, prisma } from "@/lib/prisma";
import {
  blendKeywordAttributions,
  summarizeOverview,
  type KeywordAttributionRow,
} from "./attribution";
import { getDemoSourceRows } from "./demo-data";
import {
  buildQueryMappingAnalysis,
  summarizeMapping,
  type Ga4MappingRow,
  type GscMappingRow,
  type QueryMappingBucket,
} from "./query-mapping";
import {
  offlineDbStats,
  readOfflineGa4Rows,
  readOfflineGscRows,
  readOfflineLastSyncedAt,
  readOfflineMappingSources,
} from "./offline-db";
import { dataSourceMode, isDemoMode, useOfflineDb } from "@/lib/app-mode";
import { readCachedMappingSources } from "./sync";
import { toDateKey, hourFromStorage } from "@/lib/range";
import {
  rollupConversionEvents,
  rollupGscLandingPages,
  rollupLandingPages,
  type ConversionEventRollup,
  type LandingPageRollup,
} from "./rollups";

async function loadMappingSources(params: {
  propertyId?: string | null;
  from: Date;
  to: Date;
}): Promise<{ gsc: GscMappingRow[]; ga4: Ga4MappingRow[] }> {
  const fromKey = toDateKey(params.from);
  const toKey = toDateKey(params.to);

  if (isDemoMode()) {
    const demo = getDemoSourceRows(30);
    return {
      gsc: demo.gsc.filter((r) => r.date >= fromKey && r.date <= toKey),
      ga4: demo.ga4.filter((r) => r.date >= fromKey && r.date <= toKey),
    };
  }
  if (useOfflineDb()) {
    return readOfflineMappingSources(fromKey, toKey);
  }
  if (params.propertyId) {
    return readCachedMappingSources(params.propertyId, params.from, params.to);
  }
  return { gsc: [], ga4: [] };
}

export async function getLandingPageRollups(params: {
  propertyId?: string | null;
  from: Date;
  to: Date;
}): Promise<LandingPageRollup[]> {
  const [attributionRows, sources] = await Promise.all([
    getAttributionRows(params),
    loadMappingSources(params),
  ]);

  const rollups = rollupLandingPages(attributionRows, sources.ga4);
  if (rollups.length) return rollups;

  if (sources.gsc.length) {
    return rollupGscLandingPages(sources.gsc);
  }
  return [];
}

export async function getConversionEventRollups(params: {
  propertyId?: string | null;
  from: Date;
  to: Date;
  mode?: "all" | "key";
}): Promise<ConversionEventRollup[]> {
  const sources = await loadMappingSources(params);
  return rollupConversionEvents(sources.ga4, params.mode ?? "key");
}


function mapCachedAttribution(r: {
  date: Date;
  hour?: string | null;
  keyword: string;
  landingPage: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  pageTotalClicks: number;
  clickShare: number;
  organicConversions: number;
  estimatedConversions: number;
  estimatedConvRate: number;
  estimatedValue: number;
  eventBreakdown: unknown;
}): KeywordAttributionRow {
  return {
    date: r.date.toISOString().slice(0, 10),
    hour: hourFromStorage(r.hour),
    keyword: r.keyword,
    landingPage: r.landingPage,
    clicks: r.clicks,
    impressions: r.impressions,
    ctr: r.ctr,
    position: r.position,
    pageTotalClicks: r.pageTotalClicks,
    clickShare: r.clickShare,
    organicConversions: r.organicConversions,
    estimatedConversions: r.estimatedConversions,
    estimatedConvRate: r.estimatedConvRate,
    estimatedValue: r.estimatedValue,
    eventBreakdown: (r.eventBreakdown as KeywordAttributionRow["eventBreakdown"]) ?? [],
  };
}

export async function getAttributionRows(params: {
  propertyId?: string | null;
  from: Date;
  to: Date;
}): Promise<KeywordAttributionRow[]> {
  const fromKey = toDateKey(params.from);
  const toKey = toDateKey(params.to);

  if (isDemoMode()) {
    const { gsc, ga4 } = getDemoSourceRows(30);
    return blendKeywordAttributions(gsc, ga4).filter(
      (r) => r.date >= fromKey && r.date <= toKey,
    );
  }

  if (useOfflineDb()) {
    const gsc = readOfflineGscRows(fromKey, toKey);
    const ga4 = readOfflineGa4Rows(fromKey, toKey);
    return blendKeywordAttributions(gsc, ga4);
  }

  if (!params.propertyId) return [];

  try {
    const cached = await prisma.keywordAttribution.findMany({
      where: {
        propertyId: params.propertyId,
        date: { gte: params.from, lte: params.to },
      },
      orderBy: [{ estimatedConversions: "desc" }, { clicks: "desc" }],
    });
    if (cached.length) return cached.map(mapCachedAttribution);
  } catch (err) {
    if (!isDatabaseConnectionError(err)) throw err;
  }

  return [];
}

export async function getOverviewStats(params: {
  propertyId?: string | null;
  from: Date;
  to: Date;
}) {
  const rows = await getAttributionRows(params);
  return {
    ...summarizeOverview(rows),
    rowCount: rows.length,
    source: dataSourceMode(),
    offline: useOfflineDb() ? offlineDbStats() : null,
  };
}

export async function getQueryMappingAnalysis(params: {
  propertyId?: string | null;
  from: Date;
  to: Date;
  crowdedOnly?: boolean;
  withKeyEventsOnly?: boolean;
}): Promise<{ buckets: QueryMappingBucket[]; summary: ReturnType<typeof summarizeMapping> }> {
  const fromKey = toDateKey(params.from);
  const toKey = toDateKey(params.to);

  let gsc: GscMappingRow[] = [];
  let ga4: Ga4MappingRow[] = [];
  if (isDemoMode()) {
    const demo = getDemoSourceRows(30);
    gsc = demo.gsc.filter((r) => r.date >= fromKey && r.date <= toKey);
    ga4 = demo.ga4.filter((r) => r.date >= fromKey && r.date <= toKey);
  } else if (useOfflineDb()) {
    const offline = readOfflineMappingSources(fromKey, toKey);
    gsc = offline.gsc;
    ga4 = offline.ga4;
  } else if (params.propertyId) {
    const cached = await loadMappingSources(params);
    gsc = cached.gsc;
    ga4 = cached.ga4;
  }

  let buckets = buildQueryMappingAnalysis(gsc, ga4);

  if (params.withKeyEventsOnly) {
    buckets = buckets.filter((b) => b.keyEvents > 0);
  }
  if (params.crowdedOnly) {
    buckets = buckets.filter((b) => b.keywordCount >= 2);
  }

  return { buckets, summary: summarizeMapping(buckets) };
}

export async function getLastSyncAt(propertyId?: string | null) {
  if (isDemoMode()) {
    return new Date(Date.now() - 10 * 60 * 1000);
  }
  if (useOfflineDb()) {
    return readOfflineLastSyncedAt();
  }
  if (!propertyId) return null;
  try {
    const row = await prisma.propertyMapping.findUnique({
      where: { id: propertyId },
      select: { lastSyncedAt: true },
    });
    return row?.lastSyncedAt ?? null;
  } catch (err) {
    if (isDatabaseConnectionError(err)) return null;
    throw err;
  }
}

export async function getDataSourceInfo(propertyId?: string | null) {
  const mode = dataSourceMode();
  if (mode === "offline-db") {
    return {
      mode,
      offline: offlineDbStats(),
      lastSyncedAt: await getLastSyncAt(propertyId),
      mapping: null,
    };
  }

  if (mode === "demo") {
    return {
      mode,
      offline: null,
      lastSyncedAt: await getLastSyncAt(propertyId),
      mapping: null,
    };
  }

  let mapping = null;
  let gscRows = 0;
  let ga4Rows = 0;
  try {
    mapping = propertyId
      ? await prisma.propertyMapping.findUnique({ where: { id: propertyId } })
      : null;
    if (mapping) {
      [gscRows, ga4Rows] = await Promise.all([
        prisma.gscDailyMetric.count({ where: { propertyId: mapping.id } }),
        prisma.ga4DailyMetric.count({ where: { propertyId: mapping.id } }),
      ]);
    }
  } catch (err) {
    if (!isDatabaseConnectionError(err)) throw err;
  }

  return {
    mode,
    offline: null,
    lastSyncedAt: mapping?.lastSyncedAt ?? null,
    mapping: mapping
      ? {
          name: mapping.name,
          gscSiteUrl: mapping.gscSiteUrl,
          ga4PropertyId: mapping.ga4PropertyId,
          ga4DisplayName: mapping.ga4DisplayName,
          timezone: mapping.timezone,
          gscRows,
          ga4Rows,
        }
      : null,
  };
}
