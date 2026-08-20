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
  const { buckets, summary, otherEngineEvents } = await getQueryMappingAnalysis({
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
        help="Keywords map to a landing page × hour × device × country bucket when Search Console recorded a click and GA4 recorded Organic Search from Google on that same segment. Impression-only queries are ignored. Key events from Bing, Cốc Cốc, and other engines are listed as Other Engine and are not mapped to keywords. Key events in the Google pool are split by propensity (clicks × CTR × position × reliability), not raw click share. GSC and GA4 still cannot share a session id — this is modelled attribution, not Google DDA."
      />
      <QueryMappingPanel
        buckets={buckets}
        summary={summary}
        otherEngineEvents={otherEngineEvents}
      />
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
