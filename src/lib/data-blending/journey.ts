/**
 * Conversion journey model
 * -----------------------
 * Organic search users often convert off the landing page:
 *   GSC query → Landing (/services) → Contact → Thank You (key event)
 *
 * Join rules:
 * 1. GSC `page` matches GA4 session-scoped `landingPage` (entry URL).
 * 2. Key events are attributed to that landing page via the session, even when
 *    `pagePath` (event-scoped) is /thank-you or /contact.
 * 3. `conversionPage` is stored only for journey visibility — never as the
 *    GSC join key.
 *
 * Session/cookie IDs still cannot bridge GSC↔GA4; journey mapping stays
 * probabilistic on landing×hour (+ device/country), with conversion page
 * as explanatory context.
 */

import { formatDateKey } from "./normalize";
import { normalizeLandingPage } from "./normalize";
import type { Ga4Row } from "./attribution";

export type JourneyStep = {
  landingPage: string;
  conversionPage: string;
  eventName: string;
  conversions: number;
  eventValue: number;
  /** true when conversion fired on a different page than the organic entry */
  isMultiPage: boolean;
};

export function describeJourney(landingPage: string, conversionPage: string | null | undefined) {
  const land = normalizeLandingPage(landingPage);
  const conv = normalizeLandingPage(conversionPage || landingPage);
  const isMultiPage = land !== conv;
  return {
    landingPage: land,
    conversionPage: conv,
    isMultiPage,
    label: isMultiPage ? `${land} → ${conv}` : land,
  };
}

/**
 * Fetch organic key events with BOTH session landing page and event pagePath.
 * This lets us map keywords → entry page while showing where the conversion fired.
 */
export async function fetchGa4OrganicJourneys(params: {
  accessToken: string;
  propertyId: string;
  startDate: string;
  endDate: string;
}): Promise<Ga4Row[]> {
  const property = params.propertyId.startsWith("properties/")
    ? params.propertyId
    : `properties/${params.propertyId}`;

  const rows: Ga4Row[] = [];
  let offset = 0;
  const limit = 10000;

  while (true) {
    const body = {
      dateRanges: [{ startDate: params.startDate, endDate: params.endDate }],
      dimensions: [
        { name: "date" },
        { name: "hour" },
        { name: "landingPagePlusQueryString" },
        { name: "pagePathPlusQueryString" },
        { name: "eventName" },
        { name: "deviceCategory" },
        { name: "countryId" },
        { name: "sessionDefaultChannelGroup" },
      ],
      metrics: [
        { name: "sessions" },
        { name: "keyEvents" },
        { name: "eventValue" },
      ],
      dimensionFilter: {
        andGroup: {
          expressions: [
            {
              filter: {
                fieldName: "sessionDefaultChannelGroup",
                stringFilter: { matchType: "EXACT", value: "Organic Search" },
              },
            },
            {
              filter: {
                fieldName: "isKeyEvent",
                stringFilter: { matchType: "EXACT", value: "true" },
              },
            },
          ],
        },
      },
      limit,
      offset,
    };

    const res = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/${property}:runReport`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${params.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );

    if (!res.ok) {
      // Fallback without isKeyEvent filter / hour if property rejects combo
      const text = await res.text();
      if (offset === 0) {
        return fetchGa4OrganicConversionsFallback(params);
      }
      throw new Error(`GA4 journey API error ${res.status}: ${text}`);
    }

    const json = (await res.json()) as {
      rows?: Array<{
        dimensionValues: Array<{ value: string }>;
        metricValues: Array<{ value: string }>;
      }>;
      rowCount?: number;
    };

    const batch = json.rows ?? [];
    for (const r of batch) {
      const dims = r.dimensionValues.map((d) => d.value);
      const mets = r.metricValues.map((m) => m.value);
      const rawDate = dims[0] ?? "";
      const date =
        rawDate.length === 8
          ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`
          : formatDateKey(new Date());
      const hourRaw = dims[1] ?? "";
      const hour = hourRaw !== "" ? hourRaw.padStart(2, "0") : null;

      rows.push({
        date,
        hour,
        landingPage: dims[2] || "/",
        conversionPage: dims[3] || dims[2] || "/",
        eventName: dims[4] || "(not set)",
        device: dims[5] || null,
        country: dims[6] || null,
        channelGroup: dims[7] || "Organic Search",
        sessions: Number(mets[0] || 0),
        conversions: Number(mets[1] || 0),
        eventValue: Number(mets[2] || 0),
      });
    }

    offset += batch.length;
    const rowCount = Number(json.rowCount || 0);
    if (!batch.length || offset >= rowCount || offset >= 250_000) break;
  }

  return rows;
}

/** Simpler report if the journey dimension combo is rejected */
async function fetchGa4OrganicConversionsFallback(params: {
  accessToken: string;
  propertyId: string;
  startDate: string;
  endDate: string;
}): Promise<Ga4Row[]> {
  const { fetchGa4OrganicConversions } = await import("./ga4");
  const rows = await fetchGa4OrganicConversions(params);
  return rows.map((r) => ({
    ...r,
    conversionPage: r.landingPage,
  }));
}

export function aggregateJourneys(rows: Ga4Row[]): JourneyStep[] {
  const map = new Map<string, JourneyStep>();
  for (const row of rows) {
    const landingPage = normalizeLandingPage(row.landingPage);
    const conversionPage = normalizeLandingPage(row.conversionPage || row.landingPage);
    const key = `${landingPage}::${conversionPage}::${row.eventName}`;
    const existing = map.get(key) ?? {
      landingPage,
      conversionPage,
      eventName: row.eventName,
      conversions: 0,
      eventValue: 0,
      isMultiPage: landingPage !== conversionPage,
    };
    existing.conversions += row.conversions || 0;
    existing.eventValue += row.eventValue || 0;
    map.set(key, existing);
  }
  return [...map.values()].sort((a, b) => b.conversions - a.conversions);
}
