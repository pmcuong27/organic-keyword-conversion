import { formatDateKey } from "./normalize";
import type { GscRow } from "./attribution";

type Token = { access_token: string };

export async function fetchGscSearchAnalytics(params: {
  accessToken: string;
  siteUrl: string;
  startDate: string;
  endDate: string;
}): Promise<GscRow[]> {
  const rows: GscRow[] = [];
  let startRow = 0;
  const rowLimit = 25000;

  while (true) {
    const body = {
      startDate: params.startDate,
      endDate: params.endDate,
      dimensions: ["date", "query", "page"],
      type: "web",
      dataState: "all",
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
  if (!res.ok) throw new Error(`GSC sites error ${res.status}`);
  const json = (await res.json()) as { siteEntry?: Array<{ siteUrl: string }> };
  return (json.siteEntry ?? []).map((s) => s.siteUrl);
}

export type { Token };
