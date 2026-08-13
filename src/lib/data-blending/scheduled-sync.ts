import { prisma } from "@/lib/prisma";
import { syncLiveProperty } from "@/lib/data-blending/sync";
import { rangeToDates } from "@/lib/range";
import { isLiveGoogleMode } from "@/lib/app-mode";

export type ScheduledSyncResult = {
  propertyId: string;
  userId: string;
  name: string;
  ok: boolean;
  gscRows?: number;
  ga4Rows?: number;
  blendedRows?: number;
  error?: string;
};

/**
 * Pull and store the last 24 hours of GSC + GA4 data for every saved pairing.
 * Uses refresh tokens persisted at Google sign-in (no browser session required).
 */
export async function runScheduledPropertySync(
  range = "24h",
): Promise<{
  skipped?: string;
  synced: number;
  failed: number;
  results: ScheduledSyncResult[];
}> {
  if (!isLiveGoogleMode()) {
    return {
      skipped: "Live Google mode is not enabled (DEMO_MODE or USE_OFFLINE_DB).",
      synced: 0,
      failed: 0,
      results: [],
    };
  }

  const mappings = await prisma.propertyMapping.findMany({
    orderBy: [{ updatedAt: "desc" }],
  });

  const { from, to } = rangeToDates(range);
  const results: ScheduledSyncResult[] = [];

  for (const mapping of mappings) {
    const job = await prisma.syncJob.create({
      data: {
        userId: mapping.userId,
        propertyId: mapping.id,
        status: "running",
        source: "full",
      },
    });

    try {
      const result = await syncLiveProperty({
        userId: mapping.userId,
        propertyId: mapping.id,
        from,
        to,
      });

      await prisma.syncJob.update({
        where: { id: job.id },
        data: {
          status: "ok",
          finishedAt: new Date(),
          rowsUpserted: result.blendedRows,
        },
      });

      results.push({
        propertyId: mapping.id,
        userId: mapping.userId,
        name: mapping.name,
        ok: true,
        gscRows: result.gscRows,
        ga4Rows: result.ga4Rows,
        blendedRows: result.blendedRows,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await prisma.syncJob.update({
        where: { id: job.id },
        data: {
          status: "error",
          finishedAt: new Date(),
          error: message.slice(0, 4000),
        },
      });
      results.push({
        propertyId: mapping.id,
        userId: mapping.userId,
        name: mapping.name,
        ok: false,
        error: message,
      });
    }
  }

  return {
    synced: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  };
}
