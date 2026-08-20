import { auth } from "@/auth";
import { isDemoMode, isLiveGoogleMode } from "@/lib/app-mode";
import { getOauthPublicConfig } from "@/lib/oauth-env";
import { listUserProperties } from "@/lib/properties";
import { PageHeading } from "@/components/dashboard/help-tip";
import { OauthSettingsForm } from "@/components/dashboard/oauth-settings-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

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

  return (
    <div className="space-y-6 p-6">
      <PageHeading
        title="Settings"
        help="Google OAuth fields can be updated below without editing .env. Add and switch client pairings from Client pairings."
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
          <CardTitle className="text-sm">Client pairings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {mappings.length
              ? `${mappings.length} saved pairing${mappings.length === 1 ? "" : "s"}. Add more clients, switch workspaces, or set a default from Client pairings.`
              : "No pairings yet. Connect a Search Console site with a GA4 property for each client."}
          </p>
          <Button asChild size="sm">
            <Link href="/dashboard/pairings">Manage pairings</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
