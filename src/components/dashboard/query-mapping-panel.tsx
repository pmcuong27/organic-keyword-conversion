"use client";

import { useMemo, useState } from "react";
import type { ConfidenceLevel, OtherEngineKeyEvent, QueryMappingBucket } from "@/lib/data-blending";
import { HelpTip } from "@/components/dashboard/help-tip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

function confidenceBadge(level: ConfidenceLevel) {
  if (level === "high") {
    return "bg-primary/25 text-foreground border-primary/40";
  }
  if (level === "medium") {
    return "bg-accent/20 text-foreground border-accent/40";
  }
  return "bg-muted text-muted-foreground border-border";
}

function formatHour(hour: string | null) {
  return hour ? `${hour}:00` : "All day";
}

export function QueryMappingPanel({
  buckets,
  summary,
  otherEngineEvents = [],
}: {
  buckets: QueryMappingBucket[];
  otherEngineEvents?: OtherEngineKeyEvent[];
  summary: {
    bucketCount: number;
    bucketsWithKeyEvents: number;
    crowdedBuckets: number;
    highConfidenceMappings: number;
    mediumConfidenceMappings: number;
    lowConfidenceMappings: number;
    totalSharedKeyEvents: number;
    multiPageBuckets: number;
    multiPageKeyEvents: number;
    otherEngineKeyEvents?: number;
    otherEngineEventCount?: number;
  };
}) {
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<QueryMappingBucket | null>(null);
  const [multiPageOnly, setMultiPageOnly] = useState(false);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return buckets
      .filter((b) => (multiPageOnly ? b.multiPageShare > 0 : true))
      .filter((b) => {
        if (!q) return true;
        return (
          b.landingPage.toLowerCase().includes(q) ||
          b.keywords.some((k) => k.keyword.toLowerCase().includes(q)) ||
          b.journeys.some((j) => j.conversionPage.toLowerCase().includes(q))
        );
      });
  }, [buckets, filter, multiPageOnly]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Shared click+traffic buckets
              <HelpTip label="About shared click+traffic buckets">
                Landing page × hour windows where Search Console recorded a click and GA4 recorded
                Organic Search from Google on that same page. Keywords without clicks are excluded.
              </HelpTip>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">
            {summary.bucketCount}
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Multi-page journeys
              <HelpTip label="About multi-page journeys">
                Sessions that land on one URL and fire the key event on another (for example
                /features → /thank-you). Keywords still attach to the landing page, not the
                thank-you URL.
              </HelpTip>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums text-accent">
            {summary.multiPageBuckets}
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              ({summary.multiPageKeyEvents.toFixed(0)} KE)
            </span>
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              High-confidence mappings
              <HelpTip label="About high-confidence mappings">
                Keyword mappings scoring 68% or higher on the propensity model: share strength,
                competition, click/impression sample size, pool size, and device/country segment
                match between GSC and GA4.
              </HelpTip>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums text-primary">
            {summary.highConfidenceMappings}
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Shared key events pool
              <HelpTip label="About shared key events">
                Total GA4 Google Organic Search key events in buckets that also had a Search Console
                click. Other-engine key events are listed separately and are not mapped to keywords.
              </HelpTip>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">
            {summary.totalSharedKeyEvents.toFixed(0)}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by keyword or landing page…"
          className="h-9 max-w-sm bg-card"
        />
        <Button
          size="sm"
          variant={multiPageOnly ? "default" : "outline"}
          className="h-9 text-xs"
          onClick={() => setMultiPageOnly((v) => !v)}
        >
          Multi-page journeys
        </Button>
        <Badge variant="secondary" className="ml-auto font-normal">
          {filtered.length} buckets
        </Badge>
      </div>

      <div className="space-y-3">
        {filtered.map((bucket) => (
          <button
            key={bucket.bucketId}
            type="button"
            onClick={() => setSelected(bucket)}
            className="w-full rounded-lg border border-border bg-card p-4 text-left transition-colors hover:border-primary/50 hover:bg-secondary/30"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-sm font-medium text-foreground">
                  {bucket.landingPage}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {bucket.date} · {formatHour(bucket.hour)}
                  {bucket.device || bucket.country
                    ? ` · ${[bucket.device, bucket.country].filter(Boolean).join(" · ")}`
                    : ""}{" "}
                  · {bucket.keywordCount} keywords · {bucket.totalClicks} clicks ·{" "}
                  {bucket.sessions} Google organic sessions
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="capitalize">
                  {bucket.competitionLevel}
                </Badge>
                {bucket.multiPageShare > 0 && (
                  <Badge variant="outline" className="border-accent/50 text-accent">
                    {(bucket.multiPageShare * 100).toFixed(0)}% off-landing
                  </Badge>
                )}
                <Badge variant="secondary">
                  {bucket.sessions} Google organic
                </Badge>
                <Badge className="bg-accent text-accent-foreground hover:bg-accent">
                  {bucket.keyEvents} key events
                </Badge>
                <Badge
                  variant="secondary"
                  className={cn(
                    "capitalize",
                    confidenceBadge(bucket.overallConfidenceLevel),
                  )}
                >
                  {bucket.overallConfidenceLevel}{" "}
                  {(bucket.overallConfidence * 100).toFixed(0)}% conf
                </Badge>
              </div>
            </div>

            {bucket.journeys.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {bucket.journeys.slice(0, 3).map((j) => (
                  <span
                    key={`${j.conversionPage}-${j.eventName}`}
                    className="rounded-md bg-secondary/60 px-2 py-0.5 font-mono text-[11px] text-muted-foreground"
                  >
                    {j.isMultiPage ? (
                      <>
                        land → <span className="text-foreground">{j.conversionPage}</span> ·{" "}
                        {j.eventName}
                      </>
                    ) : (
                      <>
                        on-page · {j.eventName}
                      </>
                    )}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-3 space-y-1.5">
              {bucket.keywords.slice(0, 5).map((k) => (
                <div
                  key={k.keyword}
                  className="flex flex-wrap items-center gap-2 text-sm"
                >
                  <span className="min-w-0 flex-1 truncate font-medium">{k.keyword}</span>
                  <span className="tabular-nums text-xs text-muted-foreground">
                    {(k.propensityShare * 100).toFixed(0)}% propensity
                  </span>
                  <span className="tabular-nums text-xs text-primary">
                    {k.estimatedKeyEvents.toFixed(2)} est. KE
                  </span>
                  <span
                    className={cn(
                      "rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                      confidenceBadge(k.confidence.level),
                    )}
                  >
                    {k.confidence.level} {(k.confidence.score * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
              {bucket.keywords.length > 5 && (
                <p className="text-xs text-muted-foreground">
                  +{bucket.keywords.length - 5} more keywords
                </p>
              )}
            </div>
          </button>
        ))}
        {!filtered.length && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No hour × landing buckets where Search Console recorded a click and GA4 recorded
            Organic Search from Google.
          </p>
        )}
      </div>

      {otherEngineEvents.length > 0 && (
        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              Other Engine key events
              <Badge variant="outline" className="font-normal">
                {(summary.otherEngineKeyEvents ?? otherEngineEvents.reduce((s, e) => s + e.conversions, 0)).toFixed(0)} KE
              </Badge>
              <HelpTip label="About Other Engine key events">
                These Organic Search key events came from Bing, Cốc Cốc, or another non-Google
                engine. Search Console only reports Google clicks, so they cannot be mapped to a
                keyword.
              </HelpTip>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {otherEngineEvents.slice(0, 12).map((ev) => (
              <div
                key={`${ev.date}-${ev.hour}-${ev.landingPage}-${ev.eventName}-${ev.source}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-secondary/30 px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-mono text-xs">{ev.eventName}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {ev.date} · {formatHour(ev.hour)} · {ev.landingPage}
                    {ev.device || ev.country
                      ? ` · ${[ev.device, ev.country].filter(Boolean).join(" · ")}`
                      : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-[10px] font-normal">
                    {ev.source}
                  </Badge>
                  <span className="tabular-nums text-sm">{ev.conversions.toFixed(1)} KE</span>
                </div>
              </div>
            ))}
            {otherEngineEvents.length > 12 && (
              <p className="text-xs text-muted-foreground">
                +{otherEngineEvents.length - 12} more Other Engine key events
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="pr-6 font-mono text-base">
              {selected?.landingPage}
            </SheetTitle>
            <SheetDescription>
              {selected?.date} · {formatHour(selected?.hour ?? null)}
              {selected?.device || selected?.country
                ? ` · ${[selected.device, selected.country].filter(Boolean).join(" · ")}`
                : ""}{" "}
              · click + Google Organic Search
            </SheetDescription>
          </SheetHeader>

          {selected && (
            <div className="mt-6 space-y-5 px-1">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Google Organic Search sessions</p>
                  <p className="text-lg font-semibold tabular-nums">{selected.sessions}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">GSC clicks in window</p>
                  <p className="text-lg font-semibold tabular-nums">{selected.totalClicks}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Key events in window</p>
                  <p className="text-lg font-semibold tabular-nums text-accent">
                    {selected.keyEvents}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Competing keywords</p>
                  <p className="text-lg font-semibold tabular-nums">{selected.keywordCount}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Segment</p>
                  <p className="text-lg font-semibold tabular-nums">
                    {[selected.device, selected.country].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Overall confidence</p>
                  <p className="text-lg font-semibold tabular-nums capitalize">
                    {selected.overallConfidenceLevel}{" "}
                    {(selected.overallConfidence * 100).toFixed(0)}%
                  </p>
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Conversion journeys (landing → event page)
                </p>
                <div className="space-y-1.5">
                  {selected.journeys.map((j) => (
                    <div
                      key={`${j.conversionPage}-${j.eventName}`}
                      className="rounded-md border border-border bg-secondary/30 px-3 py-2 text-sm"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs">
                          {selected.landingPage}
                          {j.isMultiPage ? (
                            <>
                              {" "}
                              → <span className="font-semibold text-accent">{j.conversionPage}</span>
                            </>
                          ) : (
                            <span className="text-muted-foreground"> (on landing)</span>
                          )}
                        </span>
                        <span className="tabular-nums">{j.conversions}</span>
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">{j.eventName}</p>
                    </div>
                  ))}
                  {!selected.journeys.length && (
                    <p className="text-sm text-muted-foreground">No journey detail for this bucket.</p>
                  )}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  GA4 events in this hour × landing
                </p>
                <div className="space-y-1.5">
                  {selected.eventBreakdown.map((ev) => (
                    <div
                      key={ev.eventName}
                      className="flex justify-between rounded-md border border-border bg-secondary/30 px-3 py-2 text-sm"
                    >
                      <span className="font-mono text-xs">
                        {ev.eventName}
                        {ev.conversionPage && ev.conversionPage !== selected.landingPage
                          ? ` @ ${ev.conversionPage}`
                          : ""}
                      </span>
                      <span className="tabular-nums">{ev.conversions}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Keyword share of the pool
                </p>
                <div className="space-y-3">
                  {selected.keywords.map((k) => (
                    <div
                      key={k.keyword}
                      className="rounded-md border border-border bg-card p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium">{k.keyword}</p>
                        <span
                          className={cn(
                            "shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase",
                            confidenceBadge(k.confidence.level),
                          )}
                        >
                          {k.confidence.level}
                        </span>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                        <span>Clicks {k.clicks}</span>
                        <span>Propensity {(k.propensityShare * 100).toFixed(1)}%</span>
                        <span>Est. KE {k.estimatedKeyEvents.toFixed(3)}</span>
                        <span>
                          {k.device ?? "—"} · {k.country ?? "—"}
                        </span>
                      </div>
                      <div className="mt-2 space-y-1">
                        {(
                          [
                            ["Propensity share", k.confidence.propensityShare],
                            ["Uniqueness", k.confidence.uniqueness],
                            ["Sample strength", k.confidence.sampleStrength],
                            ["Pool strength", k.confidence.poolStrength],
                            ["Segment match", k.confidence.segmentMatch],
                          ] as const
                        ).map(([label, value]) => (
                          <div key={label} className="flex items-center gap-2 text-[11px]">
                            <span className="w-28 text-muted-foreground">{label}</span>
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-primary"
                                style={{ width: `${Math.round(value * 100)}%` }}
                              />
                            </div>
                            <span className="w-8 tabular-nums text-right">
                              {(value * 100).toFixed(0)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
