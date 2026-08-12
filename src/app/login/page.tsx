import { isDemoMode } from "@/lib/app-mode";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { signInWithGoogle } from "@/app/actions/account";
import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/30 p-6">
      <Card className="w-full max-w-md shadow-none">
        <CardHeader>
          <CardTitle>Sign in to BlendAttrib</CardTitle>
          <CardDescription>
            Connect Google with Search Console and Analytics read access. You can pair any
            GSC site with any GA4 property that this account can open.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {process.env.GOOGLE_CLIENT_ID ? (
            <form action={signInWithGoogle}>
              <Button type="submit" className="w-full">
                Continue with Google
              </Button>
            </form>
          ) : (
            <p className="text-sm text-muted-foreground">
              Set <code>GOOGLE_CLIENT_ID</code> and <code>GOOGLE_CLIENT_SECRET</code> to enable
              Google sign-in.
            </p>
          )}
          {isDemoMode() ? (
            <Button asChild variant="outline" className="w-full">
              <Link href="/dashboard">Continue in demo mode</Link>
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
