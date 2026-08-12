import Link from "next/link";
import { getOauthPublicConfig } from "@/lib/oauth-env";
import { OauthSettingsForm } from "@/components/dashboard/oauth-settings-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function SetupPage() {
  const initial = getOauthPublicConfig();

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-6">
      <Card className="w-full max-w-lg shadow-none">
        <CardHeader>
          <CardTitle>Google sign-in setup</CardTitle>
          <CardDescription>
            Paste your OAuth Web client here. This writes to the server <code>.env</code> file so
            you do not have to edit it by hand. End users still only click Sign in with Google.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <OauthSettingsForm initial={initial} />
          <Button asChild variant="outline" className="w-full">
            <Link href="/login">Back to login</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
