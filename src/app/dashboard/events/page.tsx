import { Suspense } from "react";
import { getConversionEventRollups } from "@/lib/data-blending";
import { getDashboardContext } from "@/lib/dashboard-context";
import { rangeToDates } from "@/lib/range";
import { PageHeading } from "@/components/dashboard/help-tip";
import {
  ConversionEventsTable,
  type EventFilterMode,
} from "@/components/dashboard/conversion-events-table";
import { TableSkeleton } from "@/components/dashboard/skeletons";

function parseEventMode(value?: string): EventFilterMode {
  return value === "all" ? "all" : "key";
}

async function EventsContent({
  range,
  mode,
}: {
  range: string;
  mode: EventFilterMode;
}) {
  const { from, to } = rangeToDates(range);
  const ctx = await getDashboardContext();
  const rows = await getConversionEventRollups({
    propertyId: ctx.property?.id ?? null,
    from,
    to,
    mode,
  });

  return (
    <div className="flex h-full min-h-[calc(100svh-3.5rem)] flex-col gap-3 p-4 md:p-6">
      <PageHeading
        title="Conversion Events"
        help="Organic Search events from GA4 for the selected date range. Use All event names to see every event, or Key event = true to show only events marked as key events in GA4. Keyword attribution still uses key events only."
      />
      <ConversionEventsTable data={rows} mode={mode} />
    </div>
  );
}

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; events?: string }>;
}) {
  const sp = await searchParams;
  const range = sp.range ?? "30d";
  const mode = parseEventMode(sp.events);

  return (
    <Suspense key={`${range}-${mode}`} fallback={<TableSkeleton />}>
      <EventsContent range={range} mode={mode} />
    </Suspense>
  );
}
