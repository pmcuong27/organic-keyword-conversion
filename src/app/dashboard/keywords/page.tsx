import { Suspense } from "react";
import { subDays } from "date-fns";
import { getAttributionRows } from "@/lib/data-blending";
import { KeywordAttributionTable } from "@/components/dashboard/keyword-attribution-table";
import { TableSkeleton } from "@/components/dashboard/skeletons";

function rangeToDates(range: string) {
  const days = range === "7d" ? 7 : range === "90d" ? 90 : 30;
  const to = new Date();
  const from = subDays(to, days - 1);
  return { from, to };
}

async function KeywordsContent({ range }: { range: string }) {
  const { from, to } = rangeToDates(range);
  const rows = await getAttributionRows({ propertyId: null, from, to });

  return (
    <div className="flex h-full min-h-[calc(100svh-3.5rem)] flex-col gap-3 p-4 md:p-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Keyword Attribution</h1>
        <p className="text-sm text-muted-foreground">
          Estimated conversions weighted by keyword click share on each landing page/day
        </p>
      </div>
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
