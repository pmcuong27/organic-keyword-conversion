import { getDataSourceInfo } from "@/lib/data-blending";
import { getDashboardContext } from "@/lib/dashboard-context";
import { PageHeading } from "@/components/dashboard/help-tip";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SyncLast24HoursButton } from "@/components/dashboard/sync-last-24h-button";

export default async function SourcesPage() {
  const ctx = await getDashboardContext();
  const info = await getDataSourceInfo(ctx.property?.id ?? null);
  const mapping = info.mapping;
  const offline = info.offline;

  return (
    <div className="space-y-4 p-6">
      <PageHeading
        title="Data Sources"
        help="A pairing is one Search Console site plus one GA4 property. Data is stored per signed-in user. Download the last 24 hours to pull fresh Search Console and GA4 rows for the selected pair."
      />

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Mode</span>
        <Badge className={info.mode === "demo" ? "bg-accent" : "bg-primary text-primary-foreground"}>
          {info.mode}
        </Badge>
      </div>

      {mapping && info.mode === "live" ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-card px-4 py-3">
          <p className="text-sm text-muted-foreground">
            Pull yesterday and today from Search Console and GA4 for this pairing.
          </p>
          <SyncLast24HoursButton size="sm" />
        </div>
      ) : null}

      {mapping ? (
        <div className="grid gap-3 md:grid-cols-2">
          <Card className="shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Google Search Console</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p className="break-all">{mapping.gscSiteUrl}</p>
              <p>
                Cached rows:{" "}
                <span className="font-semibold tabular-nums">{mapping.gscRows}</span>
              </p>
            </CardContent>
          </Card>
          <Card className="shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">GA4 property</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p>
                {mapping.ga4DisplayName || mapping.ga4PropertyId}{" "}
                <span className="text-muted-foreground">({mapping.ga4PropertyId})</span>
              </p>
              <p className="text-xs text-muted-foreground">Timezone {mapping.timezone}</p>
              <p>
                Cached rows:{" "}
                <span className="font-semibold tabular-nums">{mapping.ga4Rows}</span>
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {offline ? (
        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Offline database</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              GSC rows{" "}
              <span className="font-semibold tabular-nums">{offline.gscRows ?? "—"}</span>
              {" · "}
              GA4 rows{" "}
              <span className="font-semibold tabular-nums">{offline.ga4Rows ?? "—"}</span>
            </p>
            {offline.error ? (
              <p className="text-sm text-destructive">{offline.error}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Local SQLite is for development only and is not used in hosted live mode.
              </p>
            )}
          </CardContent>
        </Card>
      ) : null}

      {info.mode === "live" && !mapping ? (
        <p className="text-sm text-muted-foreground">
          No pairing selected. Open Settings or Onboarding to connect a GSC site with a GA4
          property.
        </p>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Last synced:{" "}
        {info.lastSyncedAt ? new Date(info.lastSyncedAt).toLocaleString() : "not yet"}
      </p>
    </div>
  );
}
