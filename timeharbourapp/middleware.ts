import { NextRequest, NextResponse } from "next/server";

/**
 * Forward the original Host and protocol through Next.js rewrites so the
 * backend can construct OAuth redirect URIs that match the origin the user
 * is actually browsing from. Without this, the backend would see its own
 * internal host (e.g. localhost:3001) instead of the public-facing origin,
 * causing OAuth state-cookie / redirect_uri mismatches.
 */
export function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  const host = request.headers.get("host") || "";
  const proto = request.nextUrl.protocol.replace(":", "");

  requestHeaders.set("x-forwarded-host", host);
  requestHeaders.set("x-forwarded-proto", proto);

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: "/api/:path*",
};
