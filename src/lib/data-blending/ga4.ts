import { formatDateKey } from "./normalize";
import type { Ga4Row } from "./attribution";
import { normalizeCountry, normalizeDevice } from "./bucket";

function parseGa4DateHour(raw: string): { date: string; hour: string | null } {
  if (raw.length >= 10) {
    return {
      date: `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`,
      hour: raw.slice(8, 10),
    };
  }
  if (raw.length === 8) {
    return {
      date: `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`,
      hour: null,
    };
  }
  return { date: formatDateKey(new Date()), hour: null };
}

function organicDimensions(hourly: boolean, includeSource: boolean) {
  const dims = hourly
    ? [
        { name: "dateHour" },
        { name: "landingPagePlusQueryString" },
        { name: "eventName" },
        { name: "sessionDefaultChannelGroup" },
        { name: "deviceCategory" },
        { name: "countryId" },
      ]
    : [
        { name: "date" },
        { name: "landingPagePlusQueryString" },
        { name: "eventName" },
        { name: "sessionDefaultChannelGroup" },
        { name: "deviceCategory" },
        { name: "countryId" },
      ];
  if (includeSource) dims.push({ name: "sessionSource" });
  return dims;
}

async function runOrganicReport(params: {
  accessToken: string;
  property: string;
  startDate: string;
  endDate: string;
  hourly: boolean;
  includeSource: boolean;
}): Promise<Ga4Row[]> {
  const rows: Ga4Row[] = [];
  let offset = 0;
  const limit = 10000;

  while (true) {
    const body = {
      dateRanges: [{ startDate: params.startDate, endDate: params.endDate }],
      dimensions: organicDimensions(params.hourly, params.includeSource),
      metrics: [
        { name: "sessions" },
        { name: "eventCount" },
        { name: "keyEvents" },
        { name: "eventValue" },
      ],
      dimensionFilter: {
        filter: {
          fieldName: "sessionDefaultChannelGroup",
          stringFilter: { matchType: "EXACT", value: "Organic Search" },
        },
      },
      limit,
      offset,
    };

    const res = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/${params.property}:runReport`,
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
      const text = await res.text();
      throw new Error(`GA4 API error ${res.status}: ${text}`);
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
      const parsed = parseGa4DateHour(dims[0] ?? "");
      const date = parsed.date;
      const hour = params.hourly ? parsed.hour : null;

      const eventCount = Number(mets[1] || 0);
      const keyEvents = Number(mets[2] || 0);
      const sessions = Number(mets[0] || 0);
      if (!eventCount && !keyEvents && !sessions) continue;

      const source = params.includeSource ? (dims[6] || "").trim() : "";

      rows.push({
        date,
        hour,
        landingPage: dims[1] || "/",
        eventName: dims[2] || "(not set)",
        channelGroup: dims[3] || "Organic Search",
        device: normalizeDevice(dims[4]),
        country: normalizeCountry(dims[5]),
        source: source || null,
        sessions,
        eventCount,
        conversions: keyEvents,
        eventValue: Number(mets[3] || 0),
        isKeyEvent: keyEvents > 0,
      });
    }

    offset += batch.length;
    const rowCount = Number(json.rowCount || 0);
    if (!batch.length || offset >= rowCount || offset >= 250_000) break;
  }

  return rows;
}

export async function fetchGa4OrganicConversions(params: {
  accessToken: string;
  propertyId: string;
  startDate: string;
  endDate: string;
  hourly?: boolean;
}): Promise<Ga4Row[]> {
  const property = params.propertyId.startsWith("properties/")
    ? params.propertyId
    : `properties/${params.propertyId}`;
  const hourly = params.hourly ?? false;
  const shared = {
    accessToken: params.accessToken,
    property,
    startDate: params.startDate,
    endDate: params.endDate,
    hourly,
  };

  try {
    return await runOrganicReport({ ...shared, includeSource: true });
  } catch (err) {
    console.warn(
      "GA4 sessionSource request failed; retrying without source",
      err instanceof Error ? err.message : err,
    );
    return runOrganicReport({ ...shared, includeSource: false });
  }
}

export async function listGa4Properties(accessToken: string) {
  const out: Array<{
    propertyId: string;
    displayName: string;
    timezone: string;
    account: string;
  }> = [];

  let pageToken: string | undefined;
  do {
    const url = new URL("https://analyticsadmin.googleapis.com/v1beta/accountSummaries");
    url.searchParams.set("pageSize", "200");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`GA4 admin error ${res.status}: ${text}`);
    }

    const json = (await res.json()) as {
      accountSummaries?: Array<{
        displayName?: string;
        propertySummaries?: Array<{ property: string; displayName: string }>;
      }>;
      nextPageToken?: string;
    };

    for (const account of json.accountSummaries ?? []) {
      for (const p of account.propertySummaries ?? []) {
        out.push({
          propertyId: p.property.replace("properties/", ""),
          displayName: p.displayName,
          timezone: "UTC",
          account: account.displayName || "GA4",
        });
      }
    }
    pageToken = json.nextPageToken;
  } while (pageToken);

  return out;
}

export async function getGa4PropertyTimezone(accessToken: string, propertyId: string) {
  const name = propertyId.startsWith("properties/")
    ? propertyId
    : `properties/${propertyId}`;
  const res = await fetch(`https://analyticsadmin.googleapis.com/v1beta/${name}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return "UTC";
  const json = (await res.json()) as { timeZone?: string };
  return json.timeZone || "UTC";
}
