import { formatDateKey } from "./normalize";
import type { Ga4Row } from "./attribution";

export async function fetchGa4OrganicConversions(params: {
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
        { name: "landingPagePlusQueryString" },
        { name: "eventName" },
        { name: "sessionDefaultChannelGroup" },
      ],
      metrics: [
        { name: "sessions" },
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
      const rawDate = dims[0] ?? ""; // YYYYMMDD
      const date =
        rawDate.length === 8
          ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`
          : formatDateKey(new Date());

      rows.push({
        date,
        landingPage: dims[1] || "/",
        eventName: dims[2] || "(not set)",
        channelGroup: dims[3] || "Organic Search",
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

export async function listGa4Properties(accessToken: string) {
  const accountsRes = await fetch(
    "https://analyticsadmin.googleapis.com/v1beta/accounts",
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!accountsRes.ok) throw new Error(`GA4 admin accounts error ${accountsRes.status}`);
  const accountsJson = (await accountsRes.json()) as {
    accounts?: Array<{ name: string; displayName: string }>;
  };

  const out: Array<{
    propertyId: string;
    displayName: string;
    timezone: string;
    account: string;
  }> = [];

  for (const account of accountsJson.accounts ?? []) {
    const res = await fetch(
      `https://analyticsadmin.googleapis.com/v1beta/properties?filter=parent:${encodeURIComponent(account.name)}&pageSize=200`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!res.ok) continue;
    const json = (await res.json()) as {
      properties?: Array<{ name: string; displayName: string; timeZone?: string }>;
    };
    for (const p of json.properties ?? []) {
      out.push({
        propertyId: p.name.replace("properties/", ""),
        displayName: p.displayName,
        timezone: p.timeZone || "UTC",
        account: account.displayName,
      });
    }
  }

  return out;
}
