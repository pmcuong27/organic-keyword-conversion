import Link from "next/link";
import { redirect } from "next/navigation";
import { isDemoMode } from "@/lib/app-mode";
import { Button } from "@/components/ui/button";
import { signInWithGoogle } from "@/app/actions/account";

export default function HomePage() {
  if (isDemoMode()) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background px-6 text-center">
      <div className="space-y-3">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
          BlendAttrib
        </p>
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight">
          Attribute organic keywords to real GA4 conversions
        </h1>
        <p className="mx-auto max-w-xl text-muted-foreground">
          Sign in with Google, then pick a Search Console site and a GA4 property.
          No Cloud API setup on your side.
        </p>
      </div>
      <div className="flex gap-3">
        {process.env.GOOGLE_CLIENT_ID ? (
          <form action={signInWithGoogle}>
            <Button type="submit">Get started</Button>
          </form>
        ) : (
          <Button asChild>
            <Link href="/login">Get started</Link>
          </Button>
        )}
        <Button asChild variant="outline">
          <Link href="/login">Sign in</Link>
        </Button>
      </div>
    </div>
  );
}
