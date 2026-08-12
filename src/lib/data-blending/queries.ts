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
  type QueryMappingBucket,
} from "./query-mapping";
import {
  offlineDbStats,
  readOfflineGa4Rows,
  readOfflineGscRows,
  readOfflineLastSyncedAt,
  readOfflineMappingSources,
} from "./offline-db";

function isDemoMode() {
  return process.env.DEMO_MODE === "true";
}

function useOfflineDb() {
  return process.env.USE_OFFLINE_DB !== "false" && !isDemoMode();
}

function dateKeys(from: Date, to: Date) {
  return {
    fromKey: from.toISOString().slice(0, 10),
    toKey: to.toISOString().slice(0, 10),
  };
}

export async function getAttributionRows(params: {
  propertyId?: string | null;
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

  if (!params.propertyId) {
    const gsc = readOfflineGscRows(fromKey, toKey);
    const ga4 = readOfflineGa4Rows(fromKey, toKey);
    return blendKeywordAttributions(gsc, ga4);
  }

  const rows = await prisma.keywordAttribution.findMany({
    where: {
      propertyId: params.propertyId,
      date: { gte: params.from, lte: params.to },
    },
    orderBy: [{ estimatedConversions: "desc" }, { clicks: "desc" }],
  });

  return rows.map((r) => ({
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
  }));
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
    source: isDemoMode() ? "demo" : "offline-db",
    offline: offlineDbStats(),
  };
}

export async function getQueryMappingAnalysis(params: {
  propertyId?: string | null;
  from: Date;
  to: Date;
  crowdedOnly?: boolean;
  withKeyEventsOnly?: boolean;
}): Promise<{ buckets: QueryMappingBucket[]; summary: ReturnType<typeof summarizeMapping> }> {
  const { fromKey, toKey } = dateKeys(params.from, params.to);

  let gsc;
  let ga4;
  if (isDemoMode()) {
    const demo = getDemoSourceRows(30);
    gsc = demo.gsc.filter((r) => r.date >= fromKey && r.date <= toKey);
    ga4 = demo.ga4.filter((r) => r.date >= fromKey && r.date <= toKey);
  } else {
    const offline = readOfflineMappingSources(fromKey, toKey);
    gsc = offline.gsc;
    ga4 = offline.ga4;
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

export async function getLastSyncAt(_propertyId?: string | null) {
  if (isDemoMode()) {
    return new Date(Date.now() - 10 * 60 * 1000);
  }
  return readOfflineLastSyncedAt();
}

export async function getDataSourceInfo() {
  return {
    mode: isDemoMode() ? "demo" : "offline-db",
    offline: offlineDbStats(),
    lastSyncedAt: await getLastSyncAt(null),
  };
}
