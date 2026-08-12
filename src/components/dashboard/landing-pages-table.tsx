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
import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import type { LandingPageRollup } from "@/lib/data-blending";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function exportCsv(rows: LandingPageRollup[]) {
  const headers = [
    "landingPage",
    "keywordCount",
    "clicks",
    "impressions",
    "avgPosition",
    "organicConversions",
    "estimatedConversions",
    "estimatedValue",
    "sessions",
  ];
  const lines = [
    headers.join(","),
    ...rows.map((r) =>
      [
        JSON.stringify(r.landingPage),
        r.keywordCount,
        r.clicks,
        r.impressions,
        r.avgPosition.toFixed(2),
        r.organicConversions,
        r.estimatedConversions,
        r.estimatedValue,
        r.sessions,
      ].join(","),
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "landing-pages.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function LandingPagesTable({ data }: { data: LandingPageRollup[] }) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "estimatedConversions", desc: true },
  ]);
  const [globalFilter, setGlobalFilter] = useState("");

  const columns = useMemo<ColumnDef<LandingPageRollup>[]>(
    () => [
      {
        accessorKey: "landingPage",
        header: "Landing page",
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.landingPage}</span>
        ),
      },
      {
        accessorKey: "keywordCount",
        header: "Keywords",
        cell: ({ getValue }) => (
          <span className="tabular-nums">{Number(getValue()).toLocaleString()}</span>
        ),
        size: 90,
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
        accessorKey: "avgPosition",
        header: "Avg pos.",
        cell: ({ getValue }) => (
          <span className="tabular-nums">{Number(getValue()).toFixed(1)}</span>
        ),
        size: 90,
      },
      {
        accessorKey: "organicConversions",
        header: "Organic key events",
        cell: ({ getValue }) => (
          <span className="tabular-nums">{Number(getValue()).toFixed(1)}</span>
        ),
        size: 130,
      },
      {
        accessorKey: "estimatedConversions",
        header: "Est. conv.",
        cell: ({ getValue }) => (
          <span className="tabular-nums font-medium">{Number(getValue()).toFixed(2)}</span>
        ),
        size: 100,
      },
      {
        accessorKey: "sessions",
        header: "Sessions",
        cell: ({ getValue }) => (
          <span className="tabular-nums">{Number(getValue()).toLocaleString()}</span>
        ),
        size: 90,
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

  if (!data.length) {
    return (
      <p className="rounded-md border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
        No landing pages in this range yet. Download the last 24 hours from the Overview or
        header after pairing Search Console with GA4.
      </p>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Filter landing pages…"
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="max-w-sm"
        />
        <Button variant="outline" size="sm" className="ml-auto gap-1.5" onClick={() => exportCsv(data)}>
          <Download className="size-3.5" />
          Export CSV
        </Button>
      </div>
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
    </div>
  );
}
