import { isDatabaseConnectionError, prisma } from "@/lib/prisma";
import { blendKeywordAttributions } from "./attribution";
import { fetchGa4OrganicConversions } from "./ga4";
import { fetchGscSearchAnalytics } from "./gsc";
import { normalizeLandingPage } from "./normalize";
import { getGoogleAccessToken } from "@/lib/google-token";
import { hourToStorage, shouldUseHourlySync } from "@/lib/range";
import type { Ga4MappingRow, GscMappingRow } from "./query-mapping";

function chunk<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export async function syncLiveProperty(params: {
  userId: string;
  propertyId: string;
  from: Date;
  to: Date;
}) {
  const mapping = await prisma.propertyMapping.findFirst({
    where: { id: params.propertyId, userId: params.userId },
  }).catch((err) => {
    if (isDatabaseConnectionError(err)) {
      throw new Error("Postgres is not running. In the web folder run: npm run db:up");
    }
    throw err;
  });
  if (!mapping) throw new Error("Property mapping not found.");

  const accessToken = await getGoogleAccessToken(params.userId);
  const startDate = params.from.toISOString().slice(0, 10);
  const endDate = params.to.toISOString().slice(0, 10);
  const hourly = shouldUseHourlySync(params.from, params.to);

  const [gsc, ga4] = await Promise.all([
    fetchGscSearchAnalytics({
      accessToken,
      siteUrl: mapping.gscSiteUrl,
      startDate,
      endDate,
      hourly,
    }),
    fetchGa4OrganicConversions({
      accessToken,
      propertyId: mapping.ga4PropertyId,
      startDate,
      endDate,
      hourly,
    }),
  ]);

  const blended = blendKeywordAttributions(gsc, ga4);

  await prisma.$transaction(async (tx) => {
    await tx.gscDailyMetric.deleteMany({
      where: { propertyId: mapping.id, date: { gte: params.from, lte: params.to } },
    });
    await tx.ga4DailyMetric.deleteMany({
      where: { propertyId: mapping.id, date: { gte: params.from, lte: params.to } },
    });
    await tx.keywordAttribution.deleteMany({
      where: { propertyId: mapping.id, date: { gte: params.from, lte: params.to } },
    });

    for (const part of chunk(
      gsc.map((r) => ({
        propertyId: mapping.id,
        date: new Date(`${r.date}T00:00:00.000Z`),
        hour: hourToStorage(r.hour),
        query: r.query,
        page: r.page,
        landingPage: normalizeLandingPage(r.page),
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: r.ctr,
        position: r.position,
      })),
      1000,
    )) {
      if (part.length) await tx.gscDailyMetric.createMany({ data: part, skipDuplicates: true });
    }

    for (const part of chunk(
      ga4.map((r) => {
        const keyEvents = r.conversions || 0;
        const eventCount = r.eventCount ?? keyEvents;
        const isKeyEvent = r.isKeyEvent ?? keyEvents > 0;
        return {
          propertyId: mapping.id,
          date: new Date(`${r.date}T00:00:00.000Z`),
          hour: hourToStorage(r.hour),
          landingPage: normalizeLandingPage(r.landingPage),
          eventName: r.eventName,
          channelGroup: r.channelGroup || "Organic Search",
          sessions: r.sessions,
          eventCount,
          conversions: keyEvents,
          eventValue: r.eventValue,
          isKeyEvent,
        };
      }),
      1000,
    )) {
      if (part.length) await tx.ga4DailyMetric.createMany({ data: part, skipDuplicates: true });
    }

    for (const part of chunk(
      blended.map((r) => ({
        propertyId: mapping.id,
        date: new Date(`${r.date}T00:00:00.000Z`),
        hour: hourToStorage(r.hour),
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
        eventBreakdown: r.eventBreakdown,
      })),
      1000,
    )) {
      if (part.length) await tx.keywordAttribution.createMany({ data: part, skipDuplicates: true });
    }

    await tx.propertyMapping.update({
      where: { id: mapping.id },
      data: { lastSyncedAt: new Date() },
    });
  }, { timeout: 120_000, maxWait: 15_000 });

  return {
    gscRows: gsc.length,
    ga4Rows: ga4.length,
    blendedRows: blended.length,
    hourly,
  };
}

export async function readCachedMappingSources(
  propertyId: string,
  from: Date,
  to: Date,
): Promise<{ gsc: GscMappingRow[]; ga4: Ga4MappingRow[] }> {
  try {
    const [gscRows, ga4Rows] = await Promise.all([
      prisma.gscDailyMetric.findMany({
        where: { propertyId, date: { gte: from, lte: to } },
      }),
      prisma.ga4DailyMetric.findMany({
        where: { propertyId, date: { gte: from, lte: to } },
      }),
    ]);

    return {
      gsc: gscRows.map((r) => ({
        date: r.date.toISOString().slice(0, 10),
        hour: r.hour || null,
        query: r.query,
        page: r.landingPage || r.page,
        device: null,
        country: null,
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: r.ctr,
        position: r.position,
      })),
      ga4: ga4Rows.map((r) => ({
        date: r.date.toISOString().slice(0, 10),
        hour: r.hour || null,
        landingPage: r.landingPage,
        conversionPage: r.landingPage,
        eventName: r.eventName,
        device: null,
        country: null,
        sessions: r.sessions,
        eventCount: r.eventCount,
        conversions: r.conversions,
        eventValue: r.eventValue,
        channelGroup: r.channelGroup,
        isKeyEvent: r.isKeyEvent,
      })),
    };
  } catch (err) {
    if (isDatabaseConnectionError(err)) return { gsc: [], ga4: [] };
    throw err;
  }
}
