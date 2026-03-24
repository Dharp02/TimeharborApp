import { createAuthClient } from "better-auth/react";

// Always use same-origin (empty baseURL) so requests go through the proxy.
// The ngrok/tunnel URL is only used by socialSignInNative() for Browser.open().
export const authClient = createAuthClient({
  baseURL: "",
  fetchOptions: {
    headers: {
      "X-App-Id": "timeharbor",
    },
  },
});
