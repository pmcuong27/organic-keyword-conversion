import { formatDateKey } from "./normalize";
import type { GscRow } from "./attribution";

type Token = { access_token: string };

/** Parse GSC HOUR dimension keys (e.g. 2025-04-07T14:00:00-07:00) to 00–23. */
export function parseGscHourKey(raw: string | undefined): string | null {
  if (!raw) return null;
  const isoMatch = raw.match(/T(\d{2}):/);
  if (isoMatch) return isoMatch[1];
  const n = Number(raw);
  if (Number.isFinite(n)) {
    return String(Math.max(0, Math.min(23, Math.floor(n)))).padStart(2, "0");
  }
  return raw.slice(0, 2).padStart(2, "0");
}

export async function fetchGscSearchAnalytics(params: {
  accessToken: string;
  siteUrl: string;
  startDate: string;
  endDate: string;
  hourly?: boolean;
}): Promise<GscRow[]> {
  const rows: GscRow[] = [];
  let startRow = 0;
  const rowLimit = 25000;
  const hourly = params.hourly ?? false;
  const dimensions = hourly
    ? ["date", "hour", "query", "page"]
    : ["date", "query", "page"];

  while (true) {
    const body: Record<string, unknown> = {
      startDate: params.startDate,
      endDate: params.endDate,
      dimensions,
      type: "web",
      dataState: hourly ? "hourly_all" : "all",
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
    for (const r of batch) {
      if (hourly) {
        const [date, hourRaw, query, page] = r.keys;
        rows.push({
          date: formatDateKey(new Date(`${date}T00:00:00Z`)),
          hour: parseGscHourKey(hourRaw),
          query: query ?? "",
          page: page ?? "/",
          clicks: r.clicks ?? 0,
          impressions: r.impressions ?? 0,
          ctr: r.ctr ?? 0,
          position: r.position ?? 0,
        });
      } else {
        const [date, query, page] = r.keys;
        rows.push({
          date: formatDateKey(new Date(`${date}T00:00:00Z`)),
          query: query ?? "",
          page: page ?? "/",
          clicks: r.clicks ?? 0,
          impressions: r.impressions ?? 0,
          ctr: r.ctr ?? 0,
          position: r.position ?? 0,
        });
      }
    }

    if (batch.length < rowLimit) break;
    startRow += rowLimit;
    if (startRow >= 200_000) break;
  }

  return rows;
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
