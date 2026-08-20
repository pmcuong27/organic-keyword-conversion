import { Suspense } from "react";
import { getLandingPageRollups } from "@/lib/data-blending";
import { getDashboardContext } from "@/lib/dashboard-context";
import { rangeToDates } from "@/lib/range";
import { PageHeading } from "@/components/dashboard/help-tip";
import { LandingPagesTable } from "@/components/dashboard/landing-pages-table";
import { TableSkeleton } from "@/components/dashboard/skeletons";

async function PagesContent({ range }: { range: string }) {
  const { from, to } = rangeToDates(range);
  const ctx = await getDashboardContext();
  const rows = await getLandingPageRollups({
    propertyId: ctx.property?.id ?? null,
    from,
    to,
  });

  return (
    <div className="flex h-full min-h-[calc(100svh-3.5rem)] flex-col gap-3 p-4 md:p-6">
      <PageHeading
        title="Pages & Landing URLs"
        help="Each row is a normalized landing page. Search Console clicks and impressions are rolled up by page; GA4 Google Organic Search key events and estimated conversions come from the same date range in the header. Other-engine organic events are excluded."
      />
      <LandingPagesTable data={rows} />
    </div>
  );
}

export default async function PagesPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const sp = await searchParams;
  const range = sp.range ?? "30d";

  return (
    <Suspense key={range} fallback={<TableSkeleton />}>
      <PagesContent range={range} />
    </Suspense>
  );
}
