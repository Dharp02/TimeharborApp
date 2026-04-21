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

  // For GET/HEAD/DELETE requests without bodies, strip Content-Type to prevent backend Fastify 400 Bad Request errors
  // Fastify strictly throws if Content-Type is application/json but the body is empty.
  if (['GET', 'HEAD'].includes(request.method.toUpperCase())) {
    requestHeaders.delete('content-type');
  }

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: "/api/:path*",
};
