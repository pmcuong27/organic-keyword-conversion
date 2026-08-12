import { PageHeading } from "@/components/dashboard/help-tip";

export default function EventsPage() {
  return (
    <div className="p-6">
      <PageHeading
        title="Conversion Events"
        help="A dedicated event explorer is not built yet. Open a keyword row on Keyword Attribution to see the per-event breakdown."
      />
    </div>
  );
}
