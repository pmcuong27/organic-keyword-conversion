"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export function CommandMenu({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  if (!mounted) return null;

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <Command>
        <CommandInput placeholder="Search keywords, pages, events…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Navigate">
            <CommandItem
              onSelect={() => {
                router.push("/dashboard");
                onOpenChange(false);
              }}
            >
              Overview
            </CommandItem>
            <CommandItem
              onSelect={() => {
                router.push("/dashboard/keywords");
                onOpenChange(false);
              }}
            >
              Keyword Attribution
            </CommandItem>
            <CommandItem
              onSelect={() => {
                router.push("/dashboard/query-mapping");
                onOpenChange(false);
              }}
            >
              Query Mapping
            </CommandItem>
            <CommandItem
              onSelect={() => {
                router.push("/dashboard/pages");
                onOpenChange(false);
              }}
            >
              Pages & Landing URLs
            </CommandItem>
            <CommandItem
              onSelect={() => {
                router.push("/dashboard/events");
                onOpenChange(false);
              }}
            >
              Conversion Events
            </CommandItem>
            <CommandItem
              onSelect={() => {
                router.push("/dashboard/pairings");
                onOpenChange(false);
              }}
            >
              Client pairings
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
