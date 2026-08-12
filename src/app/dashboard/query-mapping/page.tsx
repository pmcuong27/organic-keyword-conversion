import { Suspense } from "react";
import { getQueryMappingAnalysis } from "@/lib/data-blending";
import { getDashboardContext } from "@/lib/dashboard-context";
import { rangeToDates } from "@/lib/range";
import { QueryMappingPanel } from "@/components/dashboard/query-mapping-panel";
import { DashboardSkeleton } from "@/components/dashboard/skeletons";

async function MappingContent({ range }: { range: string }) {
  const { from, to } = rangeToDates(range);
  const ctx = await getDashboardContext();
  const { buckets, summary } = await getQueryMappingAnalysis({
    propertyId: ctx.property?.id ?? null,
    userId: ctx.userId,
    from,
    to,
    crowdedOnly: false,
    withKeyEventsOnly: false,
  });

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Query Mapping Analysis</h1>
        <p className="text-sm text-muted-foreground">
          Keywords join the session <span className="text-foreground">landing page</span>, even when
          the key event fires later on Contact / Thank You. Toggle multi-page journeys to inspect
          those paths.
        </p>
      </div>
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
