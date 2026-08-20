import { auth } from "@/auth";
import { isDemoMode, isLiveGoogleMode } from "@/lib/app-mode";
import { getGoogleAccessToken } from "@/lib/google-token";
import { listGa4Properties } from "@/lib/data-blending/ga4";
import { listGscSites } from "@/lib/data-blending/gsc";
import { getDashboardContext } from "@/lib/dashboard-context";
import { PageHeading } from "@/components/dashboard/help-tip";
import { ConnectAccountsForm } from "@/components/dashboard/connect-accounts-form";
import { PairingsManager } from "@/components/dashboard/pairings-manager";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function PairingsPage() {
  if (isDemoMode() || !isLiveGoogleMode()) {
    return (
      <div className="space-y-4 p-6">
        <PageHeading
          title="Client pairings"
          help="Live Google mode is required to pair Search Console sites with GA4 properties."
        />
        <p className="text-sm text-muted-foreground">
          Turn on live Google sign-in in Settings, then return here to add client pairings.
        </p>
      </div>
    );
  }

  const session = await auth();
  if (!session?.user?.id) {
    return (
      <div className="p-6 text-sm text-muted-foreground">Sign in to manage client pairings.</div>
    );
  }

  const ctx = await getDashboardContext();
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
      <PageHeading
        title="Client pairings"
        help="Agencies can save many Search Console × GA4 pairs under one Google login. Each pair is a client workspace: dashboards, downloads, and daily sync use the pairing selected in the header."
      />

      <Card className="shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            Saved pairings ({ctx.properties.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PairingsManager
            pairings={ctx.properties}
            selectedPropertyId={ctx.property?.id ?? null}
          />
        </CardContent>
      </Card>

      <Card id="add" className="scroll-mt-20 shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Add another pairing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Choose any Search Console site and GA4 property this Google account can access.
            Give it a client name so you can switch workspaces from the header.
          </p>
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : !gscSites.length || !ga4Properties.length ? (
            <p className="text-sm text-muted-foreground">
              {gscSites.length === 0
                ? "No Search Console sites were returned for this Google account."
                : "No GA4 properties were returned for this Google account."}{" "}
              Ask each client to add this Google account as a user on their site and property.
            </p>
          ) : (
            <ConnectAccountsForm
              gscSites={gscSites}
              ga4Properties={ga4Properties}
              existingPairs={ctx.properties}
              submitLabel="Add pairing"
              nextPath="/dashboard/pairings"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
