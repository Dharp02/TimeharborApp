import { createAuthClient } from "better-auth/react";

// Capacitor builds set NEXT_PUBLIC_BETTER_AUTH_URL to bypass the Next.js rewrite proxy.
// Browser: use same-origin so requests route through Next.js rewrite proxy.
// SSR/build: must provide a valid absolute URL (relative "/" breaks new URL()).
const baseURL =
  process.env.NEXT_PUBLIC_BETTER_AUTH_URL
  || (typeof window !== "undefined" ? window.location.origin : "http://localhost");

export const authClient = createAuthClient({
  baseURL,
  fetchOptions: {
    headers: {
      "X-App-Id": "timeharbor",
    },
  },
});
