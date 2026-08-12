import { auth } from "@/auth";
import { isDemoMode, isLiveGoogleMode } from "@/lib/app-mode";
import { getOauthPublicConfig } from "@/lib/oauth-env";
import { getGoogleAccessToken } from "@/lib/google-token";
import { listGa4Properties } from "@/lib/data-blending/ga4";
import { listGscSites } from "@/lib/data-blending/gsc";
import { listUserProperties } from "@/lib/properties";
import { PageHeading } from "@/components/dashboard/help-tip";
import { ConnectAccountsForm } from "@/components/dashboard/connect-accounts-form";
import { OauthSettingsForm } from "@/components/dashboard/oauth-settings-form";
import { deletePropertyAction } from "@/app/actions/account";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function SettingsPage() {
  const oauth = getOauthPublicConfig();

  if (isDemoMode() || !isLiveGoogleMode()) {
    return (
      <div className="space-y-6 p-6">
        <PageHeading
          title="Settings"
          help="Paste Google OAuth Web client fields here instead of editing .env. Turn on live Google sign-in when you are ready to connect Search Console and GA4."
        />
        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Google sign-in</CardTitle>
          </CardHeader>
          <CardContent>
            <OauthSettingsForm initial={oauth} />
          </CardContent>
        </Card>
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
      <PageHeading
        title="Settings"
        help="Each pairing blends one Search Console site with one GA4 property. Google OAuth fields can be updated below without editing .env."
      />

      <Card className="shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Google sign-in</CardTitle>
        </CardHeader>
        <CardContent>
          <OauthSettingsForm initial={oauth} />
        </CardContent>
      </Card>

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
