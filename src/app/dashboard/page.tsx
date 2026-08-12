import { Suspense } from "react";
import { subDays } from "date-fns";
import { getOverviewStats } from "@/lib/data-blending";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { PerformanceChart } from "@/components/dashboard/performance-chart";
import { TopKeywordsList } from "@/components/dashboard/top-keywords-list";
import { DashboardSkeleton } from "@/components/dashboard/skeletons";

function rangeToDates(range: string) {
  const days = range === "7d" ? 7 : range === "90d" ? 90 : 30;
  const to = new Date();
  const from = subDays(to, days - 1);
  return { from, to };
}

async function OverviewContent({ range }: { range: string }) {
  const { from, to } = rangeToDates(range);
  const stats = await getOverviewStats({ propertyId: null, from, to });

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Overview</h1>
        <p className="text-sm text-muted-foreground">
          Organic keyword performance blended with GA4 conversions
        </p>
      </div>

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
