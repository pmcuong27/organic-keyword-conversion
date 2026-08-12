import { Suspense } from "react";
import { getAttributionRows } from "@/lib/data-blending";
import { getDashboardContext } from "@/lib/dashboard-context";
import { rangeToDates } from "@/lib/range";
import { PageHeading } from "@/components/dashboard/help-tip";
import { KeywordAttributionTable } from "@/components/dashboard/keyword-attribution-table";
import { TableSkeleton } from "@/components/dashboard/skeletons";

async function KeywordsContent({ range }: { range: string }) {
  const { from, to } = rangeToDates(range);
  const ctx = await getDashboardContext();
  const rows = await getAttributionRows({
    propertyId: ctx.property?.id ?? null,
    from,
    to,
  });

  return (
    <div className="flex h-full min-h-[calc(100svh-3.5rem)] flex-col gap-3 p-4 md:p-6">
      <PageHeading
        title="Keyword Attribution"
        help="Each row is a keyword on a landing page. Estimated conversions = that page's GA4 organic key events × the keyword's share of GSC clicks. Open a row for the event breakdown."
      />
      <KeywordAttributionTable data={rows} />
    </div>
  );
}

export default async function KeywordsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const sp = await searchParams;
  const range = sp.range ?? "30d";

  return (
    <Suspense key={range} fallback={<TableSkeleton />}>
      <KeywordsContent range={range} />
    </Suspense>
  );
}
