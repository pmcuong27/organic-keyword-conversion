import type { Ga4MappingRow } from "./query-mapping";
import type { KeywordAttributionRow } from "./attribution";
import { classifyOrganicSource, organicSourceDetail } from "./source";

export type LandingPageRollup = {
  landingPage: string;
  keywordCount: number;
  clicks: number;
  impressions: number;
  avgPosition: number;
  organicConversions: number;
  estimatedConversions: number;
  estimatedValue: number;
  sessions: number;
};

export type ConversionEventRollup = {
  eventName: string;
  sourceGroup: "google" | "other-engine";
  sourceLabel: string;
  sources: string[];
  eventCount: number;
  conversions: number;
  sessions: number;
  eventValue: number;
  landingPageCount: number;
  topLandingPage: string | null;
  isKeyEvent: boolean;
};

type PageAccumulator = {
  keywords: Set<string>;
  clicks: number;
  impressions: number;
  positionWeight: number;
  estimatedConversions: number;
  estimatedValue: number;
  organicConversions: number;
  sessions: number;
};

function emptyPageAccumulator(): PageAccumulator {
  return {
    keywords: new Set(),
    clicks: 0,
    impressions: 0,
    positionWeight: 0,
    estimatedConversions: 0,
    estimatedValue: 0,
    organicConversions: 0,
    sessions: 0,
  };
}

function isKeyEventRow(row: { isKeyEvent?: boolean; conversions?: number }) {
  return row.isKeyEvent ?? (row.conversions || 0) > 0;
}

export function rollupLandingPages(
  attributionRows: KeywordAttributionRow[],
  ga4Rows: Ga4MappingRow[],
): LandingPageRollup[] {
  const byPage = new Map<string, PageAccumulator>();

  for (const row of attributionRows) {
    const entry = byPage.get(row.landingPage) ?? emptyPageAccumulator();
    entry.keywords.add(row.keyword);
    entry.clicks += row.clicks;
    entry.impressions += row.impressions;
    entry.positionWeight += row.position * row.clicks;
    entry.estimatedConversions += row.estimatedConversions;
    entry.estimatedValue += row.estimatedValue;
    byPage.set(row.landingPage, entry);
  }

  for (const row of ga4Rows) {
    if (!isKeyEventRow(row)) continue;
    if (classifyOrganicSource(row.source) !== "google") continue;
    const entry = byPage.get(row.landingPage) ?? emptyPageAccumulator();
    entry.organicConversions += row.conversions;
    entry.sessions += row.sessions;
    byPage.set(row.landingPage, entry);
  }

  return [...byPage.entries()]
    .map(([landingPage, v]) => ({
      landingPage,
      keywordCount: v.keywords.size,
      clicks: v.clicks,
      impressions: v.impressions,
      avgPosition: v.clicks > 0 ? v.positionWeight / v.clicks : 0,
      organicConversions: v.organicConversions,
      estimatedConversions: v.estimatedConversions,
      estimatedValue: v.estimatedValue,
      sessions: v.sessions,
    }))
    .sort(
      (a, b) =>
        b.estimatedConversions - a.estimatedConversions ||
        b.clicks - a.clicks ||
        a.landingPage.localeCompare(b.landingPage),
    );
}

export function rollupConversionEvents(
  ga4Rows: Ga4MappingRow[],
  mode: "all" | "key" = "key",
): ConversionEventRollup[] {
  const byEvent = new Map<
    string,
    {
      eventName: string;
      sourceGroup: "google" | "other-engine";
      sources: Set<string>;
      eventCount: number;
      conversions: number;
      sessions: number;
      eventValue: number;
      landingPages: Map<string, number>;
      isKeyEvent: boolean;
    }
  >();

  for (const row of ga4Rows) {
    const keyEvents = row.conversions || 0;
    const eventCount = row.eventCount ?? keyEvents;
    const isKeyEvent = isKeyEventRow(row);
    if (mode === "key" && !isKeyEvent) continue;

    const sourceGroup = classifyOrganicSource(row.source);
    const mapKey = `${row.eventName}::${sourceGroup}`;
    const entry = byEvent.get(mapKey) ?? {
      eventName: row.eventName,
      sourceGroup,
      sources: new Set<string>(),
      eventCount: 0,
      conversions: 0,
      sessions: 0,
      eventValue: 0,
      landingPages: new Map<string, number>(),
      isKeyEvent: false,
    };
    const detail = organicSourceDetail(row.source);
    if (detail) entry.sources.add(detail);
    else if (sourceGroup === "google") entry.sources.add("google");
    entry.eventCount += eventCount;
    entry.conversions += keyEvents;
    entry.sessions += row.sessions;
    entry.eventValue += row.eventValue;
    entry.isKeyEvent = entry.isKeyEvent || isKeyEvent;
    const weight = mode === "key" ? keyEvents : eventCount || keyEvents;
    entry.landingPages.set(
      row.landingPage,
      (entry.landingPages.get(row.landingPage) ?? 0) + weight,
    );
    byEvent.set(mapKey, entry);
  }

  return [...byEvent.values()]
    .map((v) => {
      const topLandingPage =
        [...v.landingPages.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      const sources = [...v.sources].sort();
      return {
        eventName: v.eventName,
        sourceGroup: v.sourceGroup,
        sourceLabel: v.sourceGroup === "google" ? "Google" : "Other Engine",
        sources,
        eventCount: v.eventCount,
        conversions: v.conversions,
        sessions: v.sessions,
        eventValue: v.eventValue,
        landingPageCount: v.landingPages.size,
        topLandingPage,
        isKeyEvent: v.isKeyEvent,
      };
    })
    .sort(
      (a, b) =>
        Number(a.sourceGroup === "other-engine") - Number(b.sourceGroup === "other-engine") ||
        (mode === "key"
          ? b.conversions - a.conversions
          : b.eventCount - a.eventCount) ||
        b.sessions - a.sessions ||
        a.eventName.localeCompare(b.eventName),
    );
}

/** GSC-only landing pages that had clicks but no blended rows yet. */
export function rollupGscLandingPages(
  gscRows: Array<{
    page: string;
    query: string;
    clicks: number;
    impressions: number;
    position: number;
  }>,
): LandingPageRollup[] {
  const byPage = new Map<
    string,
    { keywords: Set<string>; clicks: number; impressions: number; positionWeight: number }
  >();

  for (const row of gscRows) {
    const entry = byPage.get(row.page) ?? {
      keywords: new Set<string>(),
      clicks: 0,
      impressions: 0,
      positionWeight: 0,
    };
    entry.keywords.add(row.query);
    entry.clicks += row.clicks;
    entry.impressions += row.impressions;
    entry.positionWeight += row.position * row.clicks;
    byPage.set(row.page, entry);
  }

  return [...byPage.entries()]
    .map(([landingPage, v]) => ({
      landingPage,
      keywordCount: v.keywords.size,
      clicks: v.clicks,
      impressions: v.impressions,
      avgPosition: v.clicks > 0 ? v.positionWeight / v.clicks : 0,
      organicConversions: 0,
      estimatedConversions: 0,
      estimatedValue: 0,
      sessions: 0,
    }))
    .sort((a, b) => b.clicks - a.clicks || a.landingPage.localeCompare(b.landingPage));
}
