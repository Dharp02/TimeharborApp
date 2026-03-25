import { createAuthClient } from "better-auth/react";

// Browser: use same-origin so requests route through Next.js rewrite proxy.
// SSR/build: must provide a valid absolute URL (relative "/" breaks new URL()).
// "http://localhost" is fine for SSR — auth client is only meaningful in the browser.
const baseURL =
  typeof window !== "undefined"
    ? window.location.origin
    : "http://localhost";

export const authClient = createAuthClient({
  baseURL,
  fetchOptions: {
    headers: {
      "X-App-Id": "timeharbor",
    },
  },
});
