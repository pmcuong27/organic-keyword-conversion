import { getDataSourceInfo } from "@/lib/data-blending";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function SourcesPage() {
  const info = await getDataSourceInfo();
  const offline = info.offline as {
    path?: string;
    gscRows?: number;
    ga4Rows?: number;
    gscRange?: { min: string | null; max: string | null };
    ga4Range?: { min: string | null; max: string | null };
    error?: string;
  };

  return (
    <div className="space-y-4 p-6">
      <div>
        <h1 className="text-lg font-semibold">Data Sources</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Live dashboard reads the offline SQLite store filled by the GSC/GA4 Python exporters.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Mode</span>
        <Badge className={info.mode === "demo" ? "bg-accent" : "bg-primary text-primary-foreground"}>
          {info.mode}
        </Badge>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Google Search Console</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>
              Rows:{" "}
              <span className="font-semibold tabular-nums">{offline.gscRows ?? "—"}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              {offline.gscRange?.min ?? "—"} → {offline.gscRange?.max ?? "—"}
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">GA4 Organic</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>
              Rows:{" "}
              <span className="font-semibold tabular-nums">{offline.ga4Rows ?? "—"}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              {offline.ga4Range?.min ?? "—"} → {offline.ga4Range?.max ?? "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Offline database</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="break-all font-mono text-xs text-muted-foreground">
            {offline.path || "not configured"}
          </p>
          {offline.error ? (
            <p className="text-sm text-destructive">{offline.error}</p>
          ) : (
            <p className="text-muted-foreground">
              Last synced:{" "}
              {info.lastSyncedAt
                ? new Date(info.lastSyncedAt).toLocaleString()
                : "unknown"}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Refresh with:{" "}
            <code className="rounded bg-secondary px-1 py-0.5">
              py main.py sync
            </code>{" "}
            and{" "}
            <code className="rounded bg-secondary px-1 py-0.5">
              py main.py ga4-sync
            </code>{" "}
            from the project root.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
