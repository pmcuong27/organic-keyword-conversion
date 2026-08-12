import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  if (
    process.env.DEMO_MODE === "true" ||
    process.env.USE_OFFLINE_DB === "true" ||
    process.env.NEXT_PUBLIC_USE_OFFLINE_DB === "true"
  ) {
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
          Blend Google Search Console queries with GA4 organic landing-page events.
          Dense, fast, WhatConverts-style analytics.
        </p>
      </div>
      <div className="flex gap-3">
        <Button asChild>
          <Link href="/login">Get started</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/dashboard">Open dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
