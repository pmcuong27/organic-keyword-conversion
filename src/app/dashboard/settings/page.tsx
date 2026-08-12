import { auth } from "@/auth";
import { isDemoMode, isLiveGoogleMode } from "@/lib/app-mode";
import { getGoogleAccessToken } from "@/lib/google-token";
import { listGa4Properties } from "@/lib/data-blending/ga4";
import { listGscSites } from "@/lib/data-blending/gsc";
import { listUserProperties } from "@/lib/properties";
import { ConnectAccountsForm } from "@/components/dashboard/connect-accounts-form";
import { deletePropertyAction } from "@/app/actions/account";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function SettingsPage() {
  if (isDemoMode()) {
    return (
      <div className="space-y-3 p-6">
        <h1 className="text-lg font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Demo mode uses sample data. Set <code>DEMO_MODE=false</code> and configure Google
          OAuth to pair real Search Console and GA4 accounts.
        </p>
      </div>
    );
  }

  if (!isLiveGoogleMode()) {
    return (
      <div className="space-y-3 p-6">
        <h1 className="text-lg font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Offline SQLite mode is active. Disable <code>USE_OFFLINE_DB</code> to connect live
          Google accounts.
        </p>
      </div>
    );
  }

  const session = await auth();
  if (!session?.user?.id) {
    return (
      <div className="p-6 text-sm text-muted-foreground">Sign in to manage property pairings.</div>
    );
  }

  const mappings = await listUserProperties(session.user.id);
  let gscSites: string[] = [];
  let ga4Properties: Awaited<ReturnType<typeof listGa4Properties>> = [];
  let error: string | null = null;
  try {
    const token = await getGoogleAccessToken(session.user.id);
    const [sites, properties] = await Promise.all([
      listGscSites(token),
      listGa4Properties(token),
    ]);
    gscSites = sites;
    ga4Properties = properties;
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-lg font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Each pairing blends one Search Console site with one GA4 property. Add as many
          client or brand pairs as this Google account can access.
        </p>
      </div>

      <Card className="shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Saved pairings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {mappings.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pairings yet.</p>
          ) : (
            mappings.map((m) => (
              <div
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-2 last:border-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{m.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    GSC {m.gscSiteUrl} · GA4 {m.ga4DisplayName || m.ga4PropertyId}
                  </p>
                </div>
                <form action={deletePropertyAction.bind(null, m.id)}>
                  <Button type="submit" variant="outline" size="sm">
                    Remove
                  </Button>
                </form>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Add another pairing</CardTitle>
        </CardHeader>
        <CardContent>
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : (
            <ConnectAccountsForm
              gscSites={gscSites}
              ga4Properties={ga4Properties}
              submitLabel="Add pairing"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
