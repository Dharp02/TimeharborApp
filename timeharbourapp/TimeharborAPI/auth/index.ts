import { authClient } from "@/lib/auth-client";
import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";

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
  if (Capacitor.isNativePlatform()) {
    return socialSignInNative("github");
  }
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
 * On native (Capacitor), open the OAuth flow in the system browser.
 * Better Auth redirects to timeharbor://auth/callback after success,
 * which the app captures via deep link. The App plugin's appUrlOpen
 * event (handled in AuthProvider) closes the browser and refreshes session.
 */
async function socialSignInNative(provider: "google" | "github") {
  const backendUrl =
    process.env.NEXT_PUBLIC_BETTER_AUTH_URL || "http://localhost:3001";
  const callbackURL = encodeURIComponent("timeharbor://auth/callback");
  const url = `${backendUrl}/api/auth/sign-in/social?provider=${provider}&callbackURL=${callbackURL}`;

  try {
    await Browser.open({ url, windowName: "_self" });
    return { data: null, error: null };
  } catch (e: any) {
    return {
      data: null,
      error: { message: e?.message ?? `Failed to open ${provider} sign-in` },
    };
  }
}

export const signOut = async () => {
  await authClient.signOut();
  notifyListeners("SIGNED_OUT", null);
  return { error: null };
};

export const getSession = async () => {
  const { data, error } = await authClient.getSession();
  if (error || !data) return { session: null, error: null };

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
  if (error || !data?.user) return { user: null, error: null };
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
