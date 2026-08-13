import { formatDateKey } from "./normalize";
import type { GscRow } from "./attribution";

type Token = { access_token: string };

/** Parse GSC HOUR dimension keys (e.g. 2025-04-07T14:00:00-07:00). */
export function parseGscHourDimension(raw: string | undefined): {
  date: string;
  hour: string | null;
} {
  if (!raw) {
    return { date: formatDateKey(new Date()), hour: null };
  }

  // ISO datetime from HOUR dimension (Pacific offset)
  const isoMatch = raw.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):/);
  if (isoMatch) {
    return { date: isoMatch[1], hour: isoMatch[2] };
  }

  // Plain date
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return { date: raw, hour: null };
  }

  const n = Number(raw);
  if (Number.isFinite(n)) {
    return {
      date: formatDateKey(new Date()),
      hour: String(Math.max(0, Math.min(23, Math.floor(n)))).padStart(2, "0"),
    };
  }

  return {
    date: formatDateKey(new Date()),
    hour: raw.slice(0, 2).padStart(2, "0"),
  };
}

/** @deprecated use parseGscHourDimension */
export function parseGscHourKey(raw: string | undefined): string | null {
  return parseGscHourDimension(raw).hour;
}

async function queryGsc(params: {
  accessToken: string;
  siteUrl: string;
  startDate: string;
  endDate: string;
  dimensions: string[];
  dataState: string;
}): Promise<
  Array<{
    keys: string[];
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>
> {
  const rows: Array<{
    keys: string[];
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }> = [];
  let startRow = 0;
  const rowLimit = 25000;

  while (true) {
    const body = {
      startDate: params.startDate,
      endDate: params.endDate,
      dimensions: params.dimensions,
      type: "web",
      dataState: params.dataState,
      rowLimit,
      startRow,
      aggregationType: "auto",
    };

    const encoded = encodeURIComponent(params.siteUrl);
    const res = await fetch(
      `https://www.googleapis.com/webmasters/v3/sites/${encoded}/searchAnalytics/query`,
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
      throw new Error(`GSC API error ${res.status}: ${text}`);
    }

    const json = (await res.json()) as {
      rows?: Array<{
        keys: string[];
        clicks: number;
        impressions: number;
        ctr: number;
        position: number;
      }>;
    };

    const batch = json.rows ?? [];
    rows.push(...batch);

    if (batch.length < rowLimit) break;
    startRow += rowLimit;
    if (startRow >= 200_000) break;
  }

  return rows;
}

export async function fetchGscSearchAnalytics(params: {
  accessToken: string;
  siteUrl: string;
  startDate: string;
  endDate: string;
  hourly?: boolean;
}): Promise<GscRow[]> {
  const hourly = params.hourly ?? false;

  if (hourly) {
    try {
      // HOUR already embeds the timestamp — do not also group by date (invalid argument).
      const batch = await queryGsc({
        accessToken: params.accessToken,
        siteUrl: params.siteUrl,
        startDate: params.startDate,
        endDate: params.endDate,
        dimensions: ["hour", "query", "page"],
        dataState: "hourly_all",
      });

      return batch.map((r) => {
        const [hourRaw, query, page] = r.keys;
        const parsed = parseGscHourDimension(hourRaw);
        return {
          date: parsed.date,
          hour: parsed.hour,
          query: query ?? "",
          page: page ?? "/",
          clicks: r.clicks ?? 0,
          impressions: r.impressions ?? 0,
          ctr: r.ctr ?? 0,
          position: r.position ?? 0,
        };
      });
    } catch (err) {
      console.warn(
        "Hourly GSC request failed; falling back to daily dimensions",
        err instanceof Error ? err.message : err,
      );
    }
  }

  const batch = await queryGsc({
    accessToken: params.accessToken,
    siteUrl: params.siteUrl,
    startDate: params.startDate,
    endDate: params.endDate,
    dimensions: ["date", "query", "page"],
    dataState: "all",
  });

  return batch.map((r) => {
    const [date, query, page] = r.keys;
    return {
      date: formatDateKey(new Date(`${date}T00:00:00Z`)),
      query: query ?? "",
      page: page ?? "/",
      clicks: r.clicks ?? 0,
      impressions: r.impressions ?? 0,
      ctr: r.ctr ?? 0,
      position: r.position ?? 0,
    };
  });
}

export async function listGscSites(accessToken: string): Promise<string[]> {
  const res = await fetch("https://www.googleapis.com/webmasters/v3/sites", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GSC sites error ${res.status}: ${text}`);
  }
  const json = (await res.json()) as { siteEntry?: Array<{ siteUrl: string }> };
  return (json.siteEntry ?? []).map((s) => s.siteUrl);
}

export type { Token };
