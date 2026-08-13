import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { isDemoMode, useOfflineDb } from "@/lib/app-mode";

export async function proxy(request: NextRequest) {
  if (isDemoMode() || useOfflineDb()) {
    return NextResponse.next();
  }

  const session = await auth();
  const isLoggedIn = !!session;
  const path = request.nextUrl.pathname;
  const isAuthPage = path.startsWith("/login");
  const isPublic =
    isAuthPage ||
    path.startsWith("/api/auth") ||
    path.startsWith("/api/cron") ||
    path === "/" ||
    path.startsWith("/setup");

  if (!isLoggedIn && (path.startsWith("/dashboard") || path.startsWith("/onboarding"))) {
    const url = new URL("/login", request.nextUrl.origin);
    url.searchParams.set("callbackUrl", path);
    return NextResponse.redirect(url);
  }

  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(new URL("/dashboard", request.nextUrl.origin));
  }

  if (!isPublic && !isLoggedIn && !path.startsWith("/api")) {
    return NextResponse.redirect(new URL("/login", request.nextUrl.origin));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
