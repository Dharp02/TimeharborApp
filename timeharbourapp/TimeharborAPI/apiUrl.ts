/**
 * Returns the base API URL.
 *
 * Priority:
 *  1. NEXT_PUBLIC_API_URL env var (baked in at compile time)
 *  2. window.location.origin + '/api'  — works through the proxy at any IP/port
 *  3. http://localhost:3001             — SSR / direct-to-backend fallback
 *
 * Using window.location.origin as the fallback means the app is resilient to
 * stale compiled bundles: even if an old JS chunk has the wrong hardcoded IP,
 * the proxy at the current origin will route /api/* correctly to the backend.
 */
export function getApiUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/api`;
  }
  return 'http://localhost:3001';
}
