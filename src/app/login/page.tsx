import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/30 p-6">
      <Card className="w-full max-w-md shadow-none">
        <CardHeader>
          <CardTitle>Sign in to BlendAttrib</CardTitle>
          <CardDescription>
            Connect Google with Search Console and Analytics read access to blend
            keywords with conversions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button asChild className="w-full">
            <Link href="/api/auth/signin/google">Continue with Google</Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href="/dashboard">Continue in demo mode</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
