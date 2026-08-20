import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isDemoMode } from "@/lib/app-mode";
import { getGoogleAccessToken } from "@/lib/google-token";
import { listGa4Properties } from "@/lib/data-blending/ga4";
import { listGscSites } from "@/lib/data-blending/gsc";
import { listUserProperties } from "@/lib/properties";
import { ConnectAccountsForm } from "@/components/dashboard/connect-accounts-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function OnboardingPage() {
  if (isDemoMode()) redirect("/dashboard");

  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const existing = await listUserProperties(session.user.id);
  if (existing.length) redirect("/dashboard/pairings");

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
    <div className="flex min-h-svh items-center justify-center bg-background p-6">
      <Card className="w-full max-w-xl shadow-none">
        <CardHeader>
          <CardTitle>Connect the first client pairing</CardTitle>
          <CardDescription>
            Pair a Search Console site with a GA4 property this Google account can access.
            You can add more client pairings after this — agencies typically save one pair per
            client.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? (
            <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
          ) : null}
          {!error && (!gscSites.length || !ga4Properties.length) ? (
            <p className="text-sm text-muted-foreground">
              {gscSites.length === 0
                ? "No Search Console sites were returned for this Google account."
                : "No GA4 properties were returned for this Google account."}{" "}
              Ask an admin to add this Google account as a user on the site/property.
              You do not need to enable Google Cloud APIs yourself.
            </p>
          ) : null}
          <ConnectAccountsForm
            gscSites={gscSites}
            ga4Properties={ga4Properties}
            submitLabel="Save first pairing"
            nextPath="/dashboard"
          />
        </CardContent>
      </Card>
    </div>
  );
}
