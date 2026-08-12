"use client";

import { useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { RefreshCw, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CommandMenu } from "@/components/dashboard/command-menu";
import { HelpTip } from "@/components/dashboard/help-tip";
import { selectPropertyAction, syncSelectedPropertyAction } from "@/app/actions/account";
import type { PropertyOption } from "@/lib/properties";

const ranges = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
];

export function AppHeader({
  lastSyncedAt,
  dataMode = "live",
  properties = [],
  selectedPropertyId = null,
}: {
  lastSyncedAt: Date | null;
  dataMode?: string;
  properties?: PropertyOption[];
  selectedPropertyId?: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [commandOpen, setCommandOpen] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const range = searchParams.get("range") ?? "30d";
  const selected =
    properties.find((p) => p.id === selectedPropertyId) ?? properties[0] ?? null;

  const syncLabel = useMemo(() => {
    if (!lastSyncedAt) return "Never synced";
    return `Last synced: ${formatDistanceToNow(lastSyncedAt, { addSuffix: true })}`;
  }, [lastSyncedAt]);

  function updateRange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", value);
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  function onPropertyChange(id: string) {
    if (id === "none") return;
    startTransition(async () => {
      await selectPropertyAction(id);
      router.refresh();
    });
  }

  function onSync() {
    setSyncError(null);
    startTransition(async () => {
      const result = await syncSelectedPropertyAction(range);
      if (result && "error" in result && result.error) {
        setSyncError(result.error);
      }
      router.refresh();
    });
  }

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <Select
          value={selected?.id ?? "none"}
          onValueChange={onPropertyChange}
          disabled={!properties.length}
        >
          <SelectTrigger className="h-8 w-[260px] text-xs">
            <SelectValue placeholder="Select GSC × GA4 pair" />
          </SelectTrigger>
          <SelectContent>
            {properties.length ? (
              properties.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))
            ) : (
              <SelectItem value="none">
                {dataMode === "demo"
                  ? "Demo data"
                  : dataMode === "offline-db"
                    ? "Offline database"
                    : "No pairing yet"}
              </SelectItem>
            )}
          </SelectContent>
        </Select>

        <Select value={range} onValueChange={updateRange}>
          <SelectTrigger className="h-8 w-[170px] text-xs">
            <SelectValue placeholder="Date range" />
          </SelectTrigger>
          <SelectContent>
            {ranges.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="sm"
          className="hidden h-8 gap-2 text-xs md:inline-flex"
          onClick={() => setCommandOpen(true)}
        >
          <Search className="size-3.5" />
          Search keywords…
          <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            ⌘K
          </kbd>
        </Button>

        <div className="ml-auto flex items-center gap-2">
          {dataMode === "live" ? (
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={onSync}
              disabled={pending || !selected}
            >
              <RefreshCw className={`size-3 ${pending ? "animate-spin" : ""}`} />
              Sync
            </Button>
          ) : null}
          <Badge
            className={
              dataMode === "demo"
                ? "bg-accent text-accent-foreground"
                : "bg-primary text-primary-foreground"
            }
          >
            {dataMode}
          </Badge>
          <HelpTip label="About data mode">
            {dataMode === "live"
              ? "Live mode reads Search Console and GA4 for the selected pairing using the signed-in Google account."
              : dataMode === "demo"
                ? "Demo mode shows sample data so you can explore the UI without Google."
                : "Offline mode reads a local SQLite export. It is for development, not hosted users."}
          </HelpTip>
          <Badge variant="secondary" className="gap-1.5 font-normal">
            <RefreshCw className={`size-3 ${pending ? "animate-spin" : ""}`} />
            {syncLabel}
          </Badge>
        </div>
      </header>
      {syncError ? (
        <p className="border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-xs text-destructive">
          {syncError}
        </p>
      ) : null}
      <CommandMenu open={commandOpen} onOpenChange={setCommandOpen} />
    </>
  );
}
