"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronsUpDown, Plus } from "lucide-react";
import { selectPropertyAction } from "@/app/actions/account";
import type { PropertyOption } from "@/lib/properties";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function PropertySwitcher({
  properties,
  selectedPropertyId,
  dataMode = "live",
}: {
  properties: PropertyOption[];
  selectedPropertyId: string | null;
  dataMode?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const selected =
    properties.find((p) => p.id === selectedPropertyId) ?? properties[0] ?? null;

  const placeholder =
    dataMode === "demo"
      ? "Demo data"
      : dataMode === "offline-db"
        ? "Offline database"
        : "No pairing yet";

  const grouped = useMemo(() => {
    const map = new Map<string, PropertyOption[]>();
    for (const pairing of properties) {
      const host = pairing.gscSiteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
      const list = map.get(host) ?? [];
      list.push(pairing);
      map.set(host, list);
    }
    return [...map.entries()];
  }, [properties]);

  function onSelect(id: string) {
    if (id === selected?.id) {
      setOpen(false);
      return;
    }
    setOpen(false);
    startTransition(async () => {
      await selectPropertyAction(id);
      router.refresh();
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={pending || (dataMode === "live" && !properties.length)}
          className="h-8 w-[280px] justify-between px-2.5 text-xs font-normal"
        >
          <span className="min-w-0 truncate text-left">
            {selected?.name ?? placeholder}
          </span>
          <ChevronsUpDown className="ml-2 size-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search clients or sites…" />
          <CommandList>
            <CommandEmpty>No pairings match.</CommandEmpty>
            {properties.length ? (
              grouped.map(([host, group]) => (
                <CommandGroup key={host} heading={host}>
                  {group.map((pairing) => (
                    <CommandItem
                      key={pairing.id}
                      value={`${pairing.name} ${pairing.gscSiteUrl} ${pairing.ga4DisplayName ?? ""} ${pairing.ga4PropertyId}`}
                      data-checked={pairing.id === selected?.id || undefined}
                      onSelect={() => onSelect(pairing.id)}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate">{pairing.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {pairing.ga4DisplayName || pairing.ga4PropertyId}
                        </p>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))
            ) : (
              <CommandGroup>
                <CommandItem value={placeholder} disabled>
                  {placeholder}
                </CommandItem>
              </CommandGroup>
            )}
            {dataMode === "live" ? (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    value="add pairing"
                    onSelect={() => {
                      setOpen(false);
                      router.push("/dashboard/pairings#add");
                    }}
                  >
                    <Plus className="size-4" />
                    Add client pairing
                  </CommandItem>
                </CommandGroup>
              </>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
