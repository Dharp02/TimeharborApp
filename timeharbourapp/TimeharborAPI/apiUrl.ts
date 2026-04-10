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

/**
 * Returns the backend origin (no /api suffix).
 * Used to resolve relative asset paths like /uploads/avatars/…
 */
export function getBackendOrigin(): string {
  if (process.env.NEXT_PUBLIC_BETTER_AUTH_URL) {
    return process.env.NEXT_PUBLIC_BETTER_AUTH_URL;
  }
  if (process.env.NEXT_PUBLIC_API_URL) {
    // Strip trailing /api from e.g. https://timehubbackend.os.mieweb.org/api
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/api\/?$/, '');
  }
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return 'http://localhost:3001';
}

/**
 * Resolves a backend asset path to a usable URL.
 *
 * Relative paths like /uploads/avatars/… are returned as-is so the
 * Next.js rewrite proxy handles routing them to the backend.
 * Absolute URLs and data: URIs pass through unchanged.
 */
export function resolveBackendAsset(path: string | undefined | null): string | undefined {
  if (!path) return undefined;
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path;
  }
  // Return relative path — Next.js rewrites /uploads/* to the backend
  return path.startsWith('/') ? path : `/${path}`;
}
