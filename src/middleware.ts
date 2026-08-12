import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { isDemoMode, useOfflineDb } from "@/lib/app-mode";

export default auth((req) => {
  if (isDemoMode() || useOfflineDb()) {
    return NextResponse.next();
  }

  const isLoggedIn = !!req.auth;
  const path = req.nextUrl.pathname;
  const isAuthPage = path.startsWith("/login");
  const isPublic =
    isAuthPage ||
    path.startsWith("/api/auth") ||
    path === "/";

  if (!isLoggedIn && (path.startsWith("/dashboard") || path.startsWith("/onboarding"))) {
    const url = new URL("/login", req.nextUrl.origin);
    url.searchParams.set("callbackUrl", path);
    return NextResponse.redirect(url);
  }

  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl.origin));
  }

  if (!isPublic && !isLoggedIn && !path.startsWith("/api")) {
    return NextResponse.redirect(new URL("/login", req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
