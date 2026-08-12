import { isDemoMode, isGoogleOAuthConfigured, useOfflineDb } from "@/lib/app-mode";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { signInWithGoogle } from "@/app/actions/account";
import Link from "next/link";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const googleReady = isGoogleOAuthConfigured();
  const { error } = await searchParams;

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/30 p-6">
      <Card className="w-full max-w-md shadow-none">
        <CardHeader>
          <CardTitle>Sign in to BlendAttrib</CardTitle>
          <CardDescription>
            {googleReady
              ? "Sign in with Google. We only request read access to Search Console and Analytics. You do not need your own Google Cloud project."
              : "Google sign-in is not configured yet. Use the setup form to paste your Web client ID and secret."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {error ? (
            <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error === "Configuration"
                ? "Google sign-in is missing AUTH_SECRET or client credentials. Open setup and save the Web client again, then retry."
                : error === "AccessDenied"
                  ? "Google access was denied. Grant Search Console and Analytics read access, then try again."
                  : "Google sign-in failed. Try again, or open setup and confirm the redirect URI matches this app."}
            </p>
          ) : null}
          {googleReady ? (
            <form action={signInWithGoogle}>
              <Button type="submit" className="w-full">
                Continue with Google
              </Button>
            </form>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Google sign-in is not configured on this app yet. Open setup and paste the Web
                client ID and secret — you do not need to edit <code>.env</code> by hand.
              </p>
              <Button asChild className="w-full">
                <Link href="/setup">Configure Google sign-in</Link>
              </Button>
            </div>
          )}
          {isDemoMode() || useOfflineDb() ? (
            <Button asChild variant="outline" className="w-full">
              <Link href="/dashboard">Continue without Google</Link>
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
