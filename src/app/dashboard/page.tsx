import { Suspense } from "react";
import { getOverviewStats } from "@/lib/data-blending";
import { getDashboardContext } from "@/lib/dashboard-context";
import { rangeToDates } from "@/lib/range";
import { PageHeading } from "@/components/dashboard/help-tip";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { PerformanceChart } from "@/components/dashboard/performance-chart";
import { TopKeywordsList } from "@/components/dashboard/top-keywords-list";
import { DashboardSkeleton } from "@/components/dashboard/skeletons";
import { SyncLast24HoursButton } from "@/components/dashboard/sync-last-24h-button";

async function OverviewContent({ range }: { range: string }) {
  const { from, to } = rangeToDates(range);
  const ctx = await getDashboardContext();
  const stats = await getOverviewStats({
    propertyId: ctx.property?.id ?? null,
    from,
    to,
  });

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <PageHeading
          title="Overview"
          help="GSC clicks and impressions are joined to GA4 Organic Search key events from Google (session source google) on the same landing page, hour, device, and country. Key events from other organic engines are excluded from keyword estimates. After you pair a Search Console site with a GA4 property, download the last 24 hours to populate the dashboard."
        />
        {ctx.property ? (
          <p className="text-xs text-muted-foreground">{ctx.property.name}</p>
        ) : null}
      </div>

      {stats.rowCount === 0 ? (
        <div className="rounded-md border border-border bg-card px-4 py-4">
          {ctx.mode === "live" && ctx.property ? (
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium">Pull Search Console and GA4</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {ctx.property.name} is connected. Download yesterday and today from Google
                  Search Console and GA4 organic key events.
                </p>
              </div>
              <SyncLast24HoursButton />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No blended rows yet. Pair a Search Console site with a GA4 property, then download
              the last 24 hours.
            </p>
          )}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Organic Clicks"
          value={stats.totalClicks.toLocaleString()}
          hint={`${stats.totalImpressions.toLocaleString()} impressions`}
          help="Sum of Google Search Console clicks for the selected range, after landing-page URLs are normalized."
        />
        <KpiCard
          title="Est. Organic Conversions"
          value={stats.totalEstConversions.toFixed(1)}
          hint={`Avg CTR ${(stats.avgCtr * 100).toFixed(1)}%`}
          help="GA4 organic key events on each landing page, allocated to keywords by click share. This is an estimate, not a session-level match."
        />
        <KpiCard
          title="Top Converting Keyword"
          value={stats.topKeyword?.keyword ?? "—"}
          hint={
            stats.topKeyword
              ? `${stats.topKeyword.conversions.toFixed(2)} est. conv · ${stats.topKeyword.clicks} clicks`
              : undefined
          }
          help="Keyword with the highest estimated organic conversions in this range."
        />
        <KpiCard
          title="Top Converting Landing Page"
          value={stats.topPage?.landingPage ?? "—"}
          hint={
            stats.topPage
              ? `${stats.topPage.conversions.toFixed(2)} est. conv · ${stats.topPage.clicks} clicks`
              : undefined
          }
          help="Landing page with the highest estimated organic conversions. GSC page URLs and GA4 landing pages are matched after stripping hosts and trailing slashes."
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
