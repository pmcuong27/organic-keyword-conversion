"use client";

import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Download } from "lucide-react";
import type { ConversionEventRollup } from "@/lib/data-blending";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type EventFilterMode = "all" | "key";

function exportCsv(rows: ConversionEventRollup[], mode: EventFilterMode) {
  const headers = [
    "eventName",
    "isKeyEvent",
    "eventCount",
    "keyEvents",
    "sessions",
    "eventValue",
    "landingPageCount",
    "topLandingPage",
  ];
  const lines = [
    headers.join(","),
    ...rows.map((r) =>
      [
        JSON.stringify(r.eventName),
        r.isKeyEvent,
        r.eventCount,
        r.conversions,
        r.sessions,
        r.eventValue,
        r.landingPageCount,
        JSON.stringify(r.topLandingPage ?? ""),
      ].join(","),
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = mode === "key" ? "key-events.csv" : "all-events.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function ConversionEventsTable({
  data,
  mode,
}: {
  data: ConversionEventRollup[];
  mode: EventFilterMode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [sorting, setSorting] = useState<SortingState>([
    { id: mode === "key" ? "conversions" : "eventCount", desc: true },
  ]);
  const [globalFilter, setGlobalFilter] = useState("");

  function setMode(next: string) {
    const value = next === "all" ? "all" : "key";
    const params = new URLSearchParams(searchParams.toString());
    params.set("events", value);
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  const columns = useMemo<ColumnDef<ConversionEventRollup>[]>(
    () => [
      {
        accessorKey: "eventName",
        header: "Event name",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <span className="font-medium">{row.original.eventName}</span>
            {row.original.isKeyEvent ? (
              <Badge variant="secondary" className="text-[10px] font-normal">
                Key event
              </Badge>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: "eventCount",
        header: "Event count",
        cell: ({ getValue }) => (
          <span className="tabular-nums">{Number(getValue()).toLocaleString()}</span>
        ),
        size: 110,
      },
      {
        accessorKey: "conversions",
        header: "Key events",
        cell: ({ getValue }) => (
          <span className="tabular-nums font-medium">{Number(getValue()).toFixed(1)}</span>
        ),
        size: 110,
      },
      {
        accessorKey: "sessions",
        header: "Sessions",
        cell: ({ getValue }) => (
          <span className="tabular-nums">{Number(getValue()).toLocaleString()}</span>
        ),
        size: 100,
      },
      {
        accessorKey: "eventValue",
        header: "Value",
        cell: ({ getValue }) => (
          <span className="tabular-nums">{Number(getValue()).toFixed(2)}</span>
        ),
        size: 90,
      },
      {
        accessorKey: "landingPageCount",
        header: "Landing pages",
        cell: ({ getValue }) => (
          <span className="tabular-nums">{Number(getValue()).toLocaleString()}</span>
        ),
        size: 120,
      },
      {
        accessorKey: "topLandingPage",
        header: "Top landing page",
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.original.topLandingPage ?? "—"}
          </span>
        ),
      },
    ],
    [],
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Tabs value={mode} onValueChange={setMode}>
          <TabsList>
            <TabsTrigger value="all" disabled={pending}>
              All event names
            </TabsTrigger>
            <TabsTrigger value="key" disabled={pending}>
              Key event = true
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <Input
          placeholder="Filter event names…"
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="max-w-sm"
        />
        <Button
          variant="outline"
          size="sm"
          className="ml-auto gap-1.5"
          onClick={() => exportCsv(data, mode)}
          disabled={!data.length}
        >
          <Download className="size-3.5" />
          Export CSV
        </Button>
      </div>

      {!data.length ? (
        <p className="rounded-md border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
          {mode === "key"
            ? "No organic key events in this range yet. Download the last 24 hours, or switch to All event names."
            : "No organic events in this range yet. Download the last 24 hours from the Overview or header after pairing Search Console with GA4."}
        </p>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto rounded-md border border-border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((group) => (
                <TableRow key={group.id}>
                  {group.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className="cursor-pointer whitespace-nowrap text-xs"
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {{
                        asc: " ↑",
                        desc: " ↓",
                      }[header.column.getIsSorted() as string] ?? null}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-2 text-sm">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
