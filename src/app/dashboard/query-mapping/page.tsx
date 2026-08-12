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
        help="When several keywords share a landing page in the same window, they also share that page's key events. Keywords join on the session landing page, even if the event fires later on Contact or Thank You. Confidence = 45% click share + 25% uniqueness + 15% device overlap + 15% country overlap. GSC and GA4 still cannot share a session or cookie id."
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
