"use client";

import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useMemo, useRef, useState, useTransition } from "react";
import { Download, SlidersHorizontal } from "lucide-react";
import type { KeywordAttributionRow } from "@/lib/data-blending";
import { HelpTip } from "@/components/dashboard/help-tip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    help?: React.ReactNode;
  }
}

function exportCsv(rows: KeywordAttributionRow[]) {
  const headers = [
    "date",
    "hour",
    "keyword",
    "landingPage",
    "clicks",
    "impressions",
    "ctr",
    "organicConversions",
    "estimatedConversions",
    "estimatedConvRate",
    "estimatedValue",
  ];
  const lines = [
    headers.join(","),
    ...rows.map((r) =>
      [
        r.date,
        r.hour ?? "",
        JSON.stringify(r.keyword),
        JSON.stringify(r.landingPage),
        r.clicks,
        r.impressions,
        r.ctr,
        r.organicConversions,
        r.estimatedConversions,
        r.estimatedConvRate,
        r.estimatedValue,
      ].join(","),
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "keyword-attribution.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function formatHourLabel(hour: string | null) {
  if (!hour) return "—";
  return `${hour}:00`;
}

export function KeywordAttributionTable({ data }: { data: KeywordAttributionRow[] }) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "estimatedConversions", desc: true },
  ]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    date: true,
    hour: true,
  });
  const [selected, setSelected] = useState<KeywordAttributionRow | null>(null);
  const [pending, startTransition] = useTransition();
  const parentRef = useRef<HTMLDivElement>(null);

  const showDate = columnVisibility.date !== false;
  const showHour = columnVisibility.hour !== false;

  const columns = useMemo<ColumnDef<KeywordAttributionRow>[]>(
    () => [
      {
        accessorKey: "date",
        header: "Date",
        cell: ({ getValue }) => (
          <span className="tabular-nums text-xs">{String(getValue())}</span>
        ),
        size: 110,
      },
      {
        accessorKey: "hour",
        header: "Hour",
        cell: ({ row }) => (
          <span className="tabular-nums text-xs">{formatHourLabel(row.original.hour)}</span>
        ),
        size: 80,
      },
      {
        accessorKey: "keyword",
        header: "Keyword",
        cell: ({ row }) => (
          <span className="font-medium text-foreground">{row.original.keyword}</span>
        ),
        size: 220,
      },
      {
        accessorKey: "landingPage",
        header: "Target Landing Page",
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">{row.original.landingPage}</span>
        ),
        size: 240,
      },
      {
        accessorKey: "clicks",
        header: "Clicks",
        cell: ({ getValue }) => (
          <span className="tabular-nums">{Number(getValue()).toLocaleString()}</span>
        ),
        size: 90,
      },
      {
        accessorKey: "impressions",
        header: "Impressions",
        cell: ({ getValue }) => (
          <span className="tabular-nums">{Number(getValue()).toLocaleString()}</span>
        ),
        size: 110,
      },
      {
        accessorKey: "ctr",
        header: "CTR",
        cell: ({ getValue }) => (
          <span className="tabular-nums">{(Number(getValue()) * 100).toFixed(1)}%</span>
        ),
        size: 80,
      },
      {
        accessorKey: "organicConversions",
        header: "GA4 Organic Conv.",
        meta: {
          help: (
            <HelpTip label="About GA4 organic conversions">
              Key events on this landing page from Organic Search, before they are split across
              keywords.
            </HelpTip>
          ),
        },
        cell: ({ getValue }) => (
          <span className="tabular-nums">{Number(getValue()).toFixed(2)}</span>
        ),
        size: 140,
      },
      {
        accessorKey: "estimatedConversions",
        header: "Est. Conversions",
        meta: {
          help: (
            <HelpTip label="About estimated conversions">
              Page key events × this keyword&apos;s share of clicks on that page and day.
            </HelpTip>
          ),
        },
        cell: ({ getValue }) => (
          <span className="tabular-nums font-semibold text-primary">
            {Number(getValue()).toFixed(3)}
          </span>
        ),
        size: 130,
      },
      {
        accessorKey: "estimatedConvRate",
        header: "Est. Conv. Rate",
        meta: {
          help: (
            <HelpTip label="About estimated conversion rate">
              Estimated conversions divided by GSC clicks for this keyword.
            </HelpTip>
          ),
        },
        cell: ({ getValue }) => (
          <span className="tabular-nums">{(Number(getValue()) * 100).toFixed(2)}%</span>
        ),
        size: 120,
      },
      {
        accessorKey: "estimatedValue",
        header: "Est. Value",
        cell: ({ getValue }) => (
          <span className="tabular-nums text-accent">${Number(getValue()).toFixed(2)}</span>
        ),
        size: 100,
      },
    ],
    [],
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter, columnVisibility },
    onSortingChange: setSorting,
    onGlobalFilterChange: (v) => startTransition(() => setGlobalFilter(String(v ?? ""))),
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const rows = table.getRowModel().rows;
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 44,
    overscan: 16,
  });

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={globalFilter}
          onChange={(e) => startTransition(() => setGlobalFilter(e.target.value))}
          placeholder="Filter keywords or pages…"
          className="h-9 max-w-sm bg-card"
        />

        <div className="flex items-center gap-1 rounded-md border border-border bg-card p-1">
          <Button
            type="button"
            size="sm"
            variant={showDate ? "default" : "ghost"}
            className="h-7 px-2.5 text-xs"
            onClick={() =>
              startTransition(() =>
                setColumnVisibility((v) => ({ ...v, date: !(v.date !== false) })),
              )
            }
          >
            Date
          </Button>
          <Button
            type="button"
            size="sm"
            variant={showHour ? "default" : "ghost"}
            className="h-7 px-2.5 text-xs"
            onClick={() =>
              startTransition(() =>
                setColumnVisibility((v) => ({ ...v, hour: !(v.hour !== false) })),
              )
            }
          >
            Hour
          </Button>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-2 bg-card">
              <SlidersHorizontal className="size-3.5" />
              Columns
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {table.getAllColumns().map((column) => (
              <DropdownMenuCheckboxItem
                key={column.id}
                checked={column.getIsVisible()}
                onCheckedChange={(v) => column.toggleVisibility(!!v)}
              >
                {typeof column.columnDef.header === "string"
                  ? column.columnDef.header
                  : column.id}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-2 bg-card"
          onClick={() => exportCsv(rows.map((r) => r.original))}
        >
          <Download className="size-3.5" />
          CSV
        </Button>
        <Badge variant="secondary" className="ml-auto font-normal">
          {pending ? "Filtering…" : `${rows.length.toLocaleString()} rows`}
        </Badge>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-card">
        <div
          className="sticky top-0 z-10 grid border-b border-border bg-secondary/50 text-xs font-medium text-muted-foreground"
          style={{
            gridTemplateColumns: table
              .getVisibleLeafColumns()
              .map((c) => `${c.getSize()}px`)
              .join(" "),
          }}
        >
          {table.getHeaderGroups().map((hg) =>
            hg.headers.map((header) => (
              <div
                key={header.id}
                className="flex items-center gap-1 px-3 py-2.5 text-left"
              >
                <button
                  type="button"
                  className="min-w-0 text-left hover:text-foreground"
                  onClick={header.column.getToggleSortingHandler()}
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                  {{ asc: " ↑", desc: " ↓" }[header.column.getIsSorted() as string] ?? null}
                </button>
                {header.column.columnDef.meta?.help}
              </div>
            )),
          )}
        </div>

        <div ref={parentRef} className="h-[min(70vh,720px)] overflow-auto">
          <div
            style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative" }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const row = rows[virtualRow.index];
              return (
                <div
                  key={row.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelected(row.original)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") setSelected(row.original);
                  }}
                  className="absolute left-0 top-0 grid w-full cursor-pointer border-b border-border/70 text-sm hover:bg-secondary/40"
                  style={{
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                    gridTemplateColumns: row
                      .getVisibleCells()
                      .map((c) => `${c.column.getSize()}px`)
                      .join(" "),
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <div key={cell.id} className="flex items-center overflow-hidden px-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="pr-6">{selected?.keyword}</SheetTitle>
            <SheetDescription className="font-mono text-xs">
              {selected?.landingPage}
              {selected?.date ? ` · ${selected.date}` : ""}
              {selected?.hour ? ` · ${formatHourLabel(selected.hour)}` : ""}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4 px-1">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Clicks</p>
                <p className="tabular-nums font-medium">{selected?.clicks}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Est. Conversions</p>
                <p className="tabular-nums font-medium text-primary">
                  {selected?.estimatedConversions.toFixed(3)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Click Share</p>
                <p className="tabular-nums font-medium">
                  {((selected?.clickShare ?? 0) * 100).toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Est. Value</p>
                <p className="tabular-nums font-medium text-accent">
                  ${(selected?.estimatedValue ?? 0).toFixed(2)}
                </p>
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Conversion breakdown by event
              </p>
              <div className="space-y-2">
                {(selected?.eventBreakdown ?? []).map((ev) => (
                  <div
                    key={ev.eventName}
                    className="flex items-center justify-between rounded-md border border-border bg-secondary/30 px-3 py-2 text-sm"
                  >
                    <span className="font-mono text-xs">{ev.eventName}</span>
                    <span className="tabular-nums">
                      {ev.estimatedConversions.toFixed(3)}
                    </span>
                  </div>
                ))}
                {!selected?.eventBreakdown?.length && (
                  <p className="text-sm text-muted-foreground">
                    No attributed events for this keyword window.
                  </p>
                )}
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
