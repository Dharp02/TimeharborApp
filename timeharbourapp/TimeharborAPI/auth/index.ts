import { authClient } from "@/lib/auth-client";
import { Capacitor, CapacitorCookies } from "@capacitor/core";
import { SocialLogin } from "@capgo/capacitor-social-login";
import { clearDatabase } from "../db";
import { resetTicketState } from "../tickets";

// Types — preserved from previous interface for backwards compatibility
export interface User {
  id: string;
  email: string;
  full_name?: string;
  name?: string;
  email_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface Session {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface AuthResponse {
  user: User;
  session: Session;
}

export interface AuthError {
  message: string;
  details?: any[];
}

type AuthListener = (event: string, session: any) => void;
const listeners: AuthListener[] = [];

const notifyListeners = (event: string, session: any) => {
  listeners.forEach((listener) => listener(event, session));
};

/** Map a Better Auth user object to our User interface */
function toUser(raw: any): User {
  return {
    id: raw.id,
    email: raw.email,
    full_name: raw.name ?? raw.full_name,
    name: raw.name,
    email_verified: raw.emailVerified ?? false,
    created_at: raw.createdAt ?? new Date().toISOString(),
    updated_at: raw.updatedAt ?? new Date().toISOString(),
  };
}

// ── Auth actions ──────────────────────────────────────────────────────

export const signIn = async (
  email: string,
  password: string,
): Promise<{ data: AuthResponse | null; error: AuthError | null }> => {
  const { data, error } = await authClient.signIn.email({ email, password });

  if (error) {
    return {
      data: null,
      error: { message: error.message ?? "Sign-in failed", details: [] },
    };
  }

  const user = toUser(data!.user);
  const session: Session = {
    access_token: data!.token ?? "",
    refresh_token: "",
    expires_in: 60 * 60 * 24 * 7,
  };

  notifyListeners("SIGNED_IN", { user, session });
  return { data: { user, session }, error: null };
};

export const signUp = async (
  email: string,
  password: string,
  name: string,
): Promise<{ data: AuthResponse | null; error: AuthError | null }> => {
  const { data, error } = await authClient.signUp.email({
    email,
    password,
    name,
  });

  if (error) {
    const message =
      error.message ?? "Registration failed";
    return { data: null, error: { message, details: [] } };
  }

  const user = toUser(data!.user);
  const session: Session = {
    access_token: data!.token ?? "",
    refresh_token: "",
    expires_in: 60 * 60 * 24 * 7,
  };

  notifyListeners("SIGNED_IN", { user, session });
  return { data: { user, session }, error: null };
};

export const signInWithGoogle = async () => {
  if (Capacitor.isNativePlatform()) {
    return socialSignInNative("google");
  }
  const { data, error } = await authClient.signIn.social({
    provider: "google",
    callbackURL: `${window.location.origin}/dashboard`,
  });
  if (error) {
    return { data: null, error: { message: error.message ?? "Google sign-in failed" } };
  }
  return { data, error: null };
};

export const signInWithGithub = async () => {
  // GitHub has no native Capacitor SDK — always use web redirect flow
  const { data, error } = await authClient.signIn.social({
    provider: "github",
    callbackURL: `${window.location.origin}/dashboard`,
  });
  if (error) {
    return { data: null, error: { message: error.message ?? "GitHub sign-in failed" } };
  }
  return { data, error: null };
};

/**
 * On native (Capacitor), use the native Google Sign-In SDK to get an ID token,
 * then pass it to Better Auth's signIn.social with the idToken parameter.
 * No redirect, no tunnel needed — the native SDK handles Google auth natively.
 */
async function socialSignInNative(provider: "google") {
  try {
    const res = await SocialLogin.login({
      provider,
      options: { scopes: ["email", "profile"] },
    });

    if (res.provider !== "google" || res.result.responseType !== "online") {
      return { data: null, error: { message: "Unexpected response from Google Sign-In" } };
    }

    const googleResult = res.result;
    if (!googleResult.idToken) {
      return { data: null, error: { message: "No ID token received from Google" } };
    }

    // Send the native ID token to Better Auth — it verifies and creates session
    const backendUrl =
      process.env.NEXT_PUBLIC_CAPACITOR_PROXY_URL || "http://localhost:8080";
    const response = await fetch(`${backendUrl}/api/auth/sign-in/social`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        provider,
        idToken: {
          token: googleResult.idToken,
          accessToken: googleResult.accessToken?.token,
        },
        callbackURL: "/dashboard",
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return { data: null, error: { message: err.message ?? "Sign-in failed" } };
    }

    const data = await response.json();
    if (data.user) {
      const user = toUser(data.user);
      const session: Session = {
        access_token: data.token ?? "",
        refresh_token: "",
        expires_in: 60 * 60 * 24 * 7,
      };
      notifyListeners("SIGNED_IN", { user, session });
      return { data: { user, session }, error: null };
    }

    return { data, error: null };
  } catch (e: any) {
    return {
      data: null,
      error: { message: e?.message ?? `Failed to sign in with ${provider}` },
    };
  }
}

export const signOut = async () => {
  try {
    await clearDatabase();
    resetTicketState();
    // Remove legacy notepad localStorage (migrated to Dexie, but clean up just in case)
    if (typeof window !== 'undefined') {
      localStorage.removeItem('timeharbor-notepad-notes');
    }
  } catch (e) {
    console.error('Failed to clear local database on sign-out:', e);
  }

  // Call backend sign-out — wrapped in try/catch so sign-out always completes
  // even if the backend is unreachable
  try {
    await authClient.signOut();
  } catch (e) {
    console.error('Backend sign-out request failed:', e);
  }

  // On Capacitor native, explicitly clear all cookies from the native HTTP store.
  // CapacitorHttp manages cookies separately from the WebView, so the Set-Cookie
  // header from the backend sign-out may not clear them in the native store.
  if (Capacitor.isNativePlatform()) {
    try {
      await CapacitorCookies.clearAllCookies();
    } catch (e) {
      console.error('Failed to clear native cookies:', e);
    }
  }

  notifyListeners("SIGNED_OUT", null);
  return { error: null };
};

export const getSession = async () => {
  const { data, error } = await authClient.getSession();
  if (error) return { session: null, error };
  if (!data) return { session: null, error: null };

  return {
    session: {
      access_token: data.session?.token ?? "",
      refresh_token: "",
    },
    error: null,
  };
};

export const getUser = async () => {
  const { data, error } = await authClient.getSession();
  if (error) return { user: null, error };
  if (!data?.user) return { user: null, error: null };
  return { user: toUser(data.user), error: null };
};

export const getStoredUser = async (): Promise<User | null> => {
  const { user } = await getUser();
  return user;
};

export const updateProfile = async (data: {
  full_name?: string;
  email?: string;
  github_url?: string;
  linkedin_url?: string;
  redmine_url?: string;
}) => {
  // Better Auth has a built-in updateUser for name/image.
  // For custom fields we will call a custom backend endpoint later.
  const updatePayload: Record<string, string> = {};
  if (data.full_name) updatePayload.name = data.full_name;

  const { error } = await authClient.updateUser(updatePayload);

  if (error) {
    return { user: null, error: { message: error.message ?? "Update failed" } };
  }

  const { user } = await getUser();
  return { user, error: null };
};

export const forgotPassword = async (email: string) => {
  // The Better Auth Proxy client maps `requestPasswordReset` →
  // POST /request-password-reset. We cast because the types aren't always
  // generated for this endpoint unless the server advertises sendResetPassword.
  const client = authClient as any;

  // Build an absolute redirectTo URL so the reset email link redirects
  // to the frontend (not the backend's BETTER_AUTH_URL).
  const redirectTo =
    typeof window !== "undefined"
      ? `${window.location.origin}/reset-password`
      : "/reset-password";

  try {
    const { error } = await client.requestPasswordReset({
      email,
      redirectTo,
    });

    if (error) {
      return { data: null, error: { message: error.message ?? "Failed to send reset email" } };
    }
  } catch (e: any) {
    return { data: null, error: { message: e?.message ?? "Failed to send reset email" } };
  }
  return { data: { success: true }, error: null };
};

export const resetPassword = async (token: string, password: string) => {
  const { error } = await authClient.resetPassword({
    token,
    newPassword: password,
  });

  if (error) {
    return { data: null, error: { message: error.message ?? "Password reset failed" } };
  }
  return { data: { success: true }, error: null };
};

export const clearStoredSession = async () => {
  await authClient.signOut();
};

export const refreshAccessToken = async (): Promise<{
  data: Session | null;
  error: AuthError | null;
}> => {
  // Better Auth handles session refresh via cookie automatically.
  // This function exists for interface compatibility.
  const { data } = await authClient.getSession();
  if (!data) return { data: null, error: { message: "No active session" } };
  return {
    data: {
      access_token: data.session?.token ?? "",
      refresh_token: "",
      expires_in: 60 * 60 * 24 * 7,
    },
    error: null,
  };
};

export const authenticatedFetch = async (
  url: string,
  options: RequestInit = {},
): Promise<Response> => {
  // Better Auth cookies are sent automatically by the browser.
  return fetch(url, { ...options, credentials: "include" });
};

export const onAuthStateChange = (callback: AuthListener) => {
  listeners.push(callback);

  // Subscribe to Better Auth's reactive session store for external changes
  // (e.g. session invalidated in another tab via BroadcastChannel)
  const sessionAtom = authClient.$store.atoms["$sessionSignal"];
  let unsub: (() => void) | undefined;
  if (sessionAtom?.listen) {
    unsub = sessionAtom.listen(async () => {
      const { data } = await authClient.getSession();
      if (data?.user) {
        callback("SIGNED_IN", { user: toUser(data.user), session: data.session });
      }
    });
  }

  return {
    unsubscribe: () => {
      const index = listeners.indexOf(callback);
      if (index > -1) listeners.splice(index, 1);
      unsub?.();
    },
  };
};
