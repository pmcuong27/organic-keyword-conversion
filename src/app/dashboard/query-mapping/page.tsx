import { Suspense } from "react";
import { getQueryMappingAnalysis } from "@/lib/data-blending";
import { getDashboardContext } from "@/lib/dashboard-context";
import { rangeToDates } from "@/lib/range";
import { PageHeading } from "@/components/dashboard/help-tip";
import { QueryMappingPanel } from "@/components/dashboard/query-mapping-panel";
import { DashboardSkeleton } from "@/components/dashboard/skeletons";

async function MappingContent({ range }: { range: string }) {
  const { from, to } = rangeToDates(range);
  const ctx = await getDashboardContext();
  const { buckets, summary } = await getQueryMappingAnalysis({
    propertyId: ctx.property?.id ?? null,
    from,
    to,
    crowdedOnly: false,
    withKeyEventsOnly: false,
  });

  return (
    <div className="space-y-4 p-4 md:p-6">
      <PageHeading
        title="Query Mapping Analysis"
        help="Keywords map to a landing page in the same hour only when Search Console recorded a click and GA4 recorded Organic Search visitors on that page. Impression-only queries are ignored. Key events in that hour×page window are then shared by click share. GSC and GA4 still cannot share a session or cookie id."
      />
      <QueryMappingPanel buckets={buckets} summary={summary} />
    </div>
  );
}

export default async function QueryMappingPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const sp = await searchParams;
  const range = sp.range ?? "30d";

  return (
    <Suspense key={range} fallback={<DashboardSkeleton />}>
      <MappingContent range={range} />
    </Suspense>
  );
}
