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

const ranges = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
];

export function AppHeader({
  lastSyncedAt,
  propertyLabel = "Creative Kitchens and Stone",
  dataMode = "offline-db",
}: {
  lastSyncedAt: Date | null;
  propertyLabel?: string;
  dataMode?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [commandOpen, setCommandOpen] = useState(false);

  const range = searchParams.get("range") ?? "30d";

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

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <Select defaultValue="cks">
          <SelectTrigger className="h-8 w-[220px] text-xs">
            <SelectValue placeholder="Select property" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="cks">{propertyLabel}</SelectItem>
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
          <Badge
            className={
              dataMode === "demo"
                ? "bg-accent text-accent-foreground"
                : "bg-primary text-primary-foreground"
            }
          >
            {dataMode}
          </Badge>
          <Badge variant="secondary" className="gap-1.5 font-normal">
            <RefreshCw className={`size-3 ${pending ? "animate-spin" : ""}`} />
            {syncLabel}
          </Badge>
        </div>
      </header>
      <CommandMenu open={commandOpen} onOpenChange={setCommandOpen} />
    </>
  );
}
