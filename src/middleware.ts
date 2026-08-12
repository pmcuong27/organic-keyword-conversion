import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Offline SQLite mode serves the dashboard without Google login.
 * Re-enable Auth.js middleware when GOOGLE_CLIENT_ID is configured for production.
 */
export function middleware(_req: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
