import { Suspense } from "react";
import { getOverviewStats } from "@/lib/data-blending";
import { getDashboardContext } from "@/lib/dashboard-context";
import { rangeToDates } from "@/lib/range";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { PerformanceChart } from "@/components/dashboard/performance-chart";
import { TopKeywordsList } from "@/components/dashboard/top-keywords-list";
import { DashboardSkeleton } from "@/components/dashboard/skeletons";

async function OverviewContent({ range }: { range: string }) {
  const { from, to } = rangeToDates(range);
  const ctx = await getDashboardContext();
  const stats = await getOverviewStats({
    propertyId: ctx.property?.id ?? null,
    userId: ctx.userId,
    from,
    to,
  });

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Overview</h1>
        <p className="text-sm text-muted-foreground">
          Organic keyword performance blended with GA4 conversions
          {ctx.property ? ` · ${ctx.property.name}` : ""}
        </p>
      </div>

      {stats.rowCount === 0 ? (
        <p className="rounded-md border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
          No blended rows yet. Choose a GSC × GA4 pair and click <span className="text-foreground">Sync</span>{" "}
          to pull the selected date range.
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Organic Clicks"
          value={stats.totalClicks.toLocaleString()}
          hint={`${stats.totalImpressions.toLocaleString()} impressions`}
        />
        <KpiCard
          title="Est. Organic Conversions"
          value={stats.totalEstConversions.toFixed(1)}
          hint={`Avg CTR ${(stats.avgCtr * 100).toFixed(1)}%`}
        />
        <KpiCard
          title="Top Converting Keyword"
          value={stats.topKeyword?.keyword ?? "—"}
          hint={
            stats.topKeyword
              ? `${stats.topKeyword.conversions.toFixed(2)} est. conv · ${stats.topKeyword.clicks} clicks`
              : undefined
          }
        />
        <KpiCard
          title="Top Converting Landing Page"
          value={stats.topPage?.landingPage ?? "—"}
          hint={
            stats.topPage
              ? `${stats.topPage.conversions.toFixed(2)} est. conv · ${stats.topPage.clicks} clicks`
              : undefined
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <PerformanceChart data={stats.series} />
        </div>
        <TopKeywordsList items={stats.topKeywords} />
      </div>
    </div>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const sp = await searchParams;
  const range = sp.range ?? "30d";

  return (
    <Suspense key={range} fallback={<DashboardSkeleton />}>
      <OverviewContent range={range} />
    </Suspense>
  );
}
