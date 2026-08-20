import { attributionBucketKey, bucketHasSegmentation, normalizeHour } from "./bucket";
import { formatDateKey, normalizeLandingPage, toDateOnly } from "./normalize";
import {
  keywordPropensity,
  normalizePropensityShares,
  scoreAttributionConfidence,
  type ConfidenceBreakdown,
  type ConfidenceLevel,
} from "./propensity";
import { isGoogleOrganicForJoin } from "./source";

export type { ConfidenceBreakdown, ConfidenceLevel };

export type GscRow = {
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

export type Ga4Row = {
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

export type EventBreakdown = {
  eventName: string;
  conversions: number;
  eventValue: number;
  estimatedConversions: number;
};

export type KeywordAttributionRow = {
  date: string;
  hour: string | null;
  keyword: string;
  landingPage: string;
  device: string | null;
  country: string | null;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  pageTotalClicks: number;
  clickShare: number;
  propensityShare: number;
  organicConversions: number;
  estimatedConversions: number;
  estimatedConvRate: number;
  estimatedValue: number;
  confidence: ConfidenceBreakdown;
  eventBreakdown: EventBreakdown[];
};

/**
 * Attribution model:
 * 1. Join GSC and GA4 on landing page × date × hour × device × country when available
 * 2. Weight keyword conversions by propensity (clicks × CTR × position × reliability)
 * 3. Normalize weights so each pool still sums to GA4 key events
 */
export function blendKeywordAttributions(
  gscRows: GscRow[],
  ga4Rows: Ga4Row[],
): KeywordAttributionRow[] {
  type BucketKey = string;

  type GscNorm = GscRow & {
    landingPage: string;
    dateKey: string;
    hourKey: string | null;
    bucketKey: BucketKey;
    rowKey: string;
  };

  const gscNormalized: GscNorm[] = [];

  for (const row of gscRows) {
    const landingPage = normalizeLandingPage(row.page);
    const dateKey = formatDateKey(toDateOnly(row.date));
    const hourKey = normalizeHour(row.hour);
    const bucketKey = attributionBucketKey({
      date: dateKey,
      hour: hourKey,
      landingPage,
      device: row.device,
      country: row.country,
    });
    gscNormalized.push({
      ...row,
      landingPage,
      dateKey,
      hourKey,
      bucketKey,
      rowKey: `${bucketKey}::${row.query || "(anonymized)"}`,
    });
  }

  type Ga4Agg = {
    conversions: number;
    eventValue: number;
    sessions: number;
    events: Map<string, { conversions: number; eventValue: number }>;
  };
  const ga4ByBucket = new Map<BucketKey, Ga4Agg>();

  for (const row of ga4Rows) {
    const isKey = row.isKeyEvent ?? (row.conversions || 0) > 0;
    if (!isKey) continue;
    if (!isGoogleOrganicForJoin(row.source)) continue;

    const landingPage = normalizeLandingPage(row.landingPage);
    const dateKey = formatDateKey(toDateOnly(row.date));
    const hourKey = normalizeHour(row.hour);
    const key = attributionBucketKey({
      date: dateKey,
      hour: hourKey,
      landingPage,
      device: row.device,
      country: row.country,
    });
    const agg = ga4ByBucket.get(key) ?? {
      conversions: 0,
      eventValue: 0,
      sessions: 0,
      events: new Map(),
    };
    agg.conversions += row.conversions || 0;
    agg.eventValue += row.eventValue || 0;
    agg.sessions += row.sessions || 0;
    const ev = agg.events.get(row.eventName) ?? { conversions: 0, eventValue: 0 };
    ev.conversions += row.conversions || 0;
    ev.eventValue += row.eventValue || 0;
    agg.events.set(row.eventName, ev);
    ga4ByBucket.set(key, agg);
  }

  const bucketRows = new Map<BucketKey, GscNorm[]>();
  for (const row of gscNormalized) {
    const list = bucketRows.get(row.bucketKey) ?? [];
    list.push(row);
    bucketRows.set(row.bucketKey, list);
  }

  const out: KeywordAttributionRow[] = [];

  for (const [bucketKey, rows] of bucketRows.entries()) {
    const ga4 = ga4ByBucket.get(bucketKey);
    const organicConversions = ga4?.conversions ?? 0;
    const organicValue = ga4?.eventValue ?? 0;
    const pageTotalClicks = rows.reduce((s, r) => s + (r.clicks || 0), 0);
    const keywordCount = new Set(rows.map((r) => r.query || "(anonymized)")).size;
    const segmentMatched = bucketHasSegmentation(bucketKey);

    const propensityWeights = rows.map((r) => ({
      key: r.rowKey,
      weight: keywordPropensity({
        clicks: r.clicks,
        ctr: r.ctr,
        position: r.position,
        impressions: r.impressions,
      }),
    }));
    const propensityShares = normalizePropensityShares(propensityWeights);

    for (const row of rows) {
      const clickShare = pageTotalClicks > 0 ? row.clicks / pageTotalClicks : 0;
      const propensityShare = propensityShares.get(row.rowKey) ?? clickShare;
      const estimatedConversions = organicConversions * propensityShare;
      const estimatedValue = organicValue * propensityShare;
      const estimatedConvRate = row.clicks > 0 ? estimatedConversions / row.clicks : 0;

      const confidence = scoreAttributionConfidence({
        propensityShare,
        keywordCount,
        clicks: row.clicks,
        impressions: row.impressions,
        poolKeyEvents: organicConversions,
        poolSessions: ga4?.sessions ?? 0,
        segmentMatched,
      });

      const eventBreakdown: EventBreakdown[] = ga4
        ? Array.from(ga4.events.entries())
            .map(([eventName, stats]) => ({
              eventName,
              conversions: stats.conversions,
              eventValue: stats.eventValue,
              estimatedConversions: stats.conversions * propensityShare,
            }))
            .sort((a, b) => b.estimatedConversions - a.estimatedConversions)
        : [];

      out.push({
        date: row.dateKey,
        hour: row.hourKey,
        keyword: row.query || "(anonymized)",
        landingPage: row.landingPage,
        device: row.device ?? null,
        country: row.country ?? null,
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position,
        pageTotalClicks,
        clickShare,
        propensityShare,
        organicConversions,
        estimatedConversions,
        estimatedConvRate,
        estimatedValue,
        confidence,
        eventBreakdown,
      });
    }
  }

  return out.sort(
    (a, b) =>
      b.estimatedConversions - a.estimatedConversions ||
      b.clicks - a.clicks ||
      a.keyword.localeCompare(b.keyword),
  );
}

export function summarizeOverview(rows: KeywordAttributionRow[]) {
  const totalClicks = rows.reduce((s, r) => s + r.clicks, 0);
  const totalImpressions = rows.reduce((s, r) => s + r.impressions, 0);
  const totalEstConversions = rows.reduce((s, r) => s + r.estimatedConversions, 0);
  const totalEstValue = rows.reduce((s, r) => s + r.estimatedValue, 0);

  const byKeyword = new Map<string, { clicks: number; conversions: number }>();
  const byPage = new Map<string, { clicks: number; conversions: number }>();
  const byDate = new Map<string, { clicks: number; conversions: number }>();

  for (const r of rows) {
    const k = byKeyword.get(r.keyword) ?? { clicks: 0, conversions: 0 };
    k.clicks += r.clicks;
    k.conversions += r.estimatedConversions;
    byKeyword.set(r.keyword, k);

    const p = byPage.get(r.landingPage) ?? { clicks: 0, conversions: 0 };
    p.clicks += r.clicks;
    p.conversions += r.estimatedConversions;
    byPage.set(r.landingPage, p);

    const d = byDate.get(r.date) ?? { clicks: 0, conversions: 0 };
    d.clicks += r.clicks;
    d.conversions += r.estimatedConversions;
    byDate.set(r.date, d);
  }

  const topKeyword =
    [...byKeyword.entries()].sort((a, b) => b[1].conversions - a[1].conversions)[0] ??
    null;
  const topPage =
    [...byPage.entries()].sort((a, b) => b[1].conversions - a[1].conversions)[0] ?? null;

  const series = [...byDate.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, v]) => ({ date, clicks: v.clicks, conversions: v.conversions }));

  const topKeywords = [...byKeyword.entries()]
    .map(([keyword, v]) => ({ keyword, ...v }))
    .sort((a, b) => b.conversions - a.conversions || b.clicks - a.clicks)
    .slice(0, 10);

  return {
    totalClicks,
    totalImpressions,
    totalEstConversions,
    totalEstValue,
    avgCtr: totalImpressions > 0 ? totalClicks / totalImpressions : 0,
    topKeyword: topKeyword
      ? { keyword: topKeyword[0], conversions: topKeyword[1].conversions, clicks: topKeyword[1].clicks }
      : null,
    topPage: topPage
      ? { landingPage: topPage[0], conversions: topPage[1].conversions, clicks: topPage[1].clicks }
      : null,
    series,
    topKeywords,
  };
}
