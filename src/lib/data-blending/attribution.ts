import { formatDateKey, normalizeLandingPage, toDateOnly } from "./normalize";

export type GscRow = {
  date: string; // YYYY-MM-DD
  hour?: string | null; // 00-23 when hourly
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
  /** Page where the key event fired (may differ from landing page) */
  conversionPage?: string | null;
  eventName: string;
  device?: string | null;
  country?: string | null;
  sessions: number;
  conversions: number;
  eventValue: number;
  channelGroup?: string;
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
  eventBreakdown: EventBreakdown[];
};

/**
 * Attribution model:
 * 1. Group GSC queries by normalized landing page + date (+ hour when present)
 * 2. Map GA4 organic conversions to same page + date (+ hour)
 * 3. Weight keyword conversions by click share on that page/bucket
 */
export function blendKeywordAttributions(
  gscRows: GscRow[],
  ga4Rows: Ga4Row[],
): KeywordAttributionRow[] {
  type BucketKey = string;

  const normalizeHour = (hour?: string | null) => {
    if (hour === undefined || hour === null || hour === "") return null;
    const n = Number(hour);
    if (Number.isFinite(n)) return String(Math.max(0, Math.min(23, Math.floor(n)))).padStart(2, "0");
    return hour.slice(0, 2).padStart(2, "0");
  };

  const bucketKey = (dateKey: string, hour: string | null, landingPage: string) =>
    `${dateKey}::${hour ?? "all"}::${landingPage}`;

  const pageBucketClicks = new Map<BucketKey, number>();
  const gscNormalized: Array<
    GscRow & { landingPage: string; dateKey: string; hourKey: string | null }
  > = [];

  for (const row of gscRows) {
    const landingPage = normalizeLandingPage(row.page);
    const dateKey = formatDateKey(toDateOnly(row.date));
    const hourKey = normalizeHour(row.hour);
    const key = bucketKey(dateKey, hourKey, landingPage);
    pageBucketClicks.set(key, (pageBucketClicks.get(key) ?? 0) + (row.clicks || 0));
    gscNormalized.push({ ...row, landingPage, dateKey, hourKey });
  }

  type Ga4Agg = {
    conversions: number;
    eventValue: number;
    sessions: number;
    events: Map<string, { conversions: number; eventValue: number }>;
  };
  const ga4ByBucket = new Map<BucketKey, Ga4Agg>();

  for (const row of ga4Rows) {
    const landingPage = normalizeLandingPage(row.landingPage);
    const dateKey = formatDateKey(toDateOnly(row.date));
    const hourKey = normalizeHour(row.hour);
    const key = bucketKey(dateKey, hourKey, landingPage);
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

  const out: KeywordAttributionRow[] = [];

  for (const row of gscNormalized) {
    const key = bucketKey(row.dateKey, row.hourKey, row.landingPage);
    const pageTotalClicks = pageBucketClicks.get(key) ?? 0;
    const clickShare = pageTotalClicks > 0 ? row.clicks / pageTotalClicks : 0;
    const ga4 = ga4ByBucket.get(key);
    const organicConversions = ga4?.conversions ?? 0;
    const organicValue = ga4?.eventValue ?? 0;
    const estimatedConversions = organicConversions * clickShare;
    const estimatedValue = organicValue * clickShare;
    const estimatedConvRate = row.clicks > 0 ? estimatedConversions / row.clicks : 0;

    const eventBreakdown: EventBreakdown[] = ga4
      ? Array.from(ga4.events.entries())
          .map(([eventName, stats]) => ({
            eventName,
            conversions: stats.conversions,
            eventValue: stats.eventValue,
            estimatedConversions: stats.conversions * clickShare,
          }))
          .sort((a, b) => b.estimatedConversions - a.estimatedConversions)
      : [];

    out.push({
      date: row.dateKey,
      hour: row.hourKey,
      keyword: row.query || "(anonymized)",
      landingPage: row.landingPage,
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: row.position,
      pageTotalClicks,
      clickShare,
      organicConversions,
      estimatedConversions,
      estimatedConvRate,
      estimatedValue,
      eventBreakdown,
    });
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
