import { prisma } from "@/lib/prisma";
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

function dateKeys(from: Date, to: Date) {
  return {
    fromKey: from.toISOString().slice(0, 10),
    toKey: to.toISOString().slice(0, 10),
  };
}

function mapCachedAttribution(r: {
  date: Date;
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
    hour: null,
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
  userId?: string | null;
  from: Date;
  to: Date;
}): Promise<KeywordAttributionRow[]> {
  const { fromKey, toKey } = dateKeys(params.from, params.to);

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

  const cached = await prisma.keywordAttribution.findMany({
    where: {
      propertyId: params.propertyId,
      date: { gte: params.from, lte: params.to },
    },
    orderBy: [{ estimatedConversions: "desc" }, { clicks: "desc" }],
  });

  if (cached.length) return cached.map(mapCachedAttribution);

  return [];
}

export async function getOverviewStats(params: {
  propertyId?: string | null;
  userId?: string | null;
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
  userId?: string | null;
  from: Date;
  to: Date;
  crowdedOnly?: boolean;
  withKeyEventsOnly?: boolean;
}): Promise<{ buckets: QueryMappingBucket[]; summary: ReturnType<typeof summarizeMapping> }> {
  const { fromKey, toKey } = dateKeys(params.from, params.to);

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
    const cached = await readCachedMappingSources(params.propertyId, params.from, params.to);
    gsc = cached.gsc;
    ga4 = cached.ga4;
  } else {
    gsc = [];
    ga4 = [];
  }

  let buckets = buildQueryMappingAnalysis(gsc, ga4);

  if (params.withKeyEventsOnly !== false) {
    buckets = buckets.filter((b) => b.keyEvents > 0);
  }
  if (params.crowdedOnly !== false) {
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
  const row = await prisma.propertyMapping.findUnique({
    where: { id: propertyId },
    select: { lastSyncedAt: true },
  });
  return row?.lastSyncedAt ?? null;
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

  const mapping = propertyId
    ? await prisma.propertyMapping.findUnique({ where: { id: propertyId } })
    : null;

  const [gscRows, ga4Rows] = mapping
    ? await Promise.all([
        prisma.gscDailyMetric.count({ where: { propertyId: mapping.id } }),
        prisma.ga4DailyMetric.count({ where: { propertyId: mapping.id } }),
      ])
    : [0, 0];

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
