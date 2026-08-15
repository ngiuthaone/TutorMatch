"use client";

import { useSyncExternalStore } from "react";
import type { Session } from "@supabase/supabase-js";
import { ApiClientError, getApiClient } from "./api-client";
import { getAuthCallbackUrl, isLiveMode } from "./config";
import { setLiveIdentity, type LiveIdentity } from "./identity";
import { getSupabaseClient } from "./supabase-client";
import { safeRedirectPath } from "./redirect";

export type LiveUser = LiveIdentity;

export type LiveSessionState =
  | { status: "initializing" }
  | { status: "anonymous" }
  | { status: "authenticated"; session: Session; user: LiveUser; profileErrorCode: string | null }
  | { status: "unavailable"; errorCode: string };

const SERVER_SESSION_SNAPSHOT: LiveSessionState = { status: "initializing" };

let state: LiveSessionState = { status: "initializing" };
let generation = 0;
const listeners = new Set<() => void>();

function emit(next: LiveSessionState): void {
  state = next;
  const identity: LiveIdentity | null = next.status === "authenticated" ? next.user : null;
  setLiveIdentity(identity);
  listeners.forEach((listener) => listener());
}

function identityFromSession(session: Session): LiveIdentity {
  const metadata = session.user.user_metadata as Record<string, unknown> | undefined;
  const displayName = typeof metadata?.display_name === "string" ? metadata.display_name : typeof metadata?.name === "string" ? metadata.name : "";
  return {
    id: session.user.id,
    email: session.user.email ?? null,
    name: displayName.trim() || (session.user.email?.split("@")[0] ?? "Tutoria member"),
    role: "student",
  };
}

async function synchronize(session: Session | null, attempt = 0): Promise<void> {
  const current = ++generation;
  if (!session?.access_token) {
    if (current === generation) emit({ status: "anonymous" });
    return;
  }
  let profileErrorCode: string | null = null;
  let identity = identityFromSession(session);
  try {
    const profile = await getApiClient().getMe(session.access_token);
    if (current !== generation) return;
    identity = {
      id: profile.id,
      email: profile.email ?? session.user.email ?? null,
      name: profile.name,
      role: profile.role,
      avatarUrl: profile.avatarUrl ?? undefined,
    };
  } catch (error) {
    if (current !== generation) return;
    const code = error instanceof ApiClientError ? error.code : "INTERNAL_ERROR";
    if (code === "UNAUTHORIZED" && attempt === 0) {
      try {
        const client = getSupabaseClient();
        if (!client) {
          if (current === generation) emit({ status: "unavailable", errorCode: "CONFIGURATION_ERROR" });
          return;
        }
        const refreshed = await client.auth.refreshSession();
        if (refreshed.data?.session) return synchronize(refreshed.data.session, 1);
        await client.auth.signOut();
      } catch {
        // Fail closed below without exposing provider details.
      }
    }
    profileErrorCode = code;
  }
  if (current === generation) emit({ status: "authenticated", session, user: identity, profileErrorCode });
}

let startPromise: Promise<void> | null = null;

export function ensureSession(): Promise<void> {
  if (startPromise) return startPromise;
  if (!isLiveMode()) {
    state = { status: "anonymous" };
    listeners.forEach((listener) => listener());
    return Promise.resolve();
  }
  startPromise = (async () => {
    const client = getSupabaseClient();
    if (!client) {
      emit({ status: "unavailable", errorCode: "CONFIGURATION_ERROR" });
      return;
    }
    try {
      client.auth.onAuthStateChange((event, session) => {
        if (event === "PASSWORD_RECOVERY") {
          generation++;
          emit({ status: "initializing" });
          return;
        }
        void synchronize(session);
      });
      const result = await client.auth.getSession();
      if (result.error) throw new Error("SESSION_UNAVAILABLE");
      await synchronize(result.data.session || null);
    } catch {
      emit({ status: "unavailable", errorCode: "SERVICE_UNAVAILABLE" });
    }
  })();
  return startPromise;
}

export function getSessionSnapshot(): LiveSessionState {
  return state;
}

export function subscribeSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSession(): LiveSessionState {
  void ensureSession();
  return useSyncExternalStore(subscribeSession, getSessionSnapshot, () => SERVER_SESSION_SNAPSHOT);
}

export function getSessionAccessToken(): string | null {
  const snapshot = getSessionSnapshot();
  return snapshot.status === "authenticated" ? snapshot.session.access_token : null;
}

export function getAuthenticatedEmail(): string | null {
  const snapshot = getSessionSnapshot();
  return snapshot.status === "authenticated" ? snapshot.session.user.email ?? null : null;
}

function confirmationRedirectUrl(nextPath: string): string {
  const callback = new URL(getAuthCallbackUrl());
  callback.searchParams.set("next", safeRedirectPath(nextPath));
  return callback.toString();
}

export async function resendSignupConfirmation(nextPath: string, emailHint?: string): Promise<void> {
  const client = getSupabaseClient();
  const email = emailHint?.trim() || getAuthenticatedEmail() || null;
  if (!client || !email) throw new Error("EMAIL_VERIFICATION_SESSION_REQUIRED");
  const { error } = await client.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: confirmationRedirectUrl(nextPath) },
  });
  if (error) throw mapAuthError(error);
}

export async function signInWithPassword(email: string, password: string): Promise<void> {
  const client = getSupabaseClient();
  if (!client) throw new Error("CONFIGURATION_ERROR");
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw mapAuthError(error);
  await synchronize((await client.auth.getSession()).data.session, 0);
}

export async function signUpWithPassword(email: string, password: string, name: string): Promise<{ needsConfirmation: boolean }> {
  const client = getSupabaseClient();
  if (!client) throw new Error("CONFIGURATION_ERROR");
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: {
      // `name` satisfies the frozen profiles trigger (0001 reads raw_user_meta_data->>'name');
      // `display_name` is retained for Discover vocabulary. Neither is authorization authority.
      data: { name: name.trim(), display_name: name.trim() },
      emailRedirectTo: getAuthCallbackUrl() || undefined,
    },
  });
  if (error) throw mapAuthError(error);
  const needsConfirmation = !data.session;
  if (data.session) await synchronize(data.session, 0);
  return { needsConfirmation };
}

export async function signInWithProvider(provider: "google" | "apple"): Promise<void> {
  const client = getSupabaseClient();
  if (!client) throw new Error("CONFIGURATION_ERROR");
  const callbackUrl = getAuthCallbackUrl();
  if (!callbackUrl) throw new Error("AUTH_CALLBACK_REQUIRED");
  const { error } = await client.auth.signInWithOAuth({ provider, options: { redirectTo: callbackUrl } });
  if (error) throw mapAuthError(error);
}

export async function requestPasswordReset(email: string): Promise<void> {
  const client = getSupabaseClient();
  if (!client) throw new Error("CONFIGURATION_ERROR");
  const callbackUrl = getAuthCallbackUrl();
  const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: callbackUrl || undefined });
  if (error) throw mapAuthError(error);
}

export async function updatePasswordWithSession(newPassword: string): Promise<void> {
  const client = getSupabaseClient();
  if (!client) throw new Error("CONFIGURATION_ERROR");
  const { error } = await client.auth.updateUser({ password: newPassword });
  if (error) throw mapAuthError(error);
}

export async function signOutLive(): Promise<void> {
  const client = getSupabaseClient();
  generation++;
  try {
    await client?.auth.signOut();
  } catch {
    // Fail closed: the local session is invalidated regardless of provider result.
  }
  emit({ status: "anonymous" });
}

function mapAuthError(error: { code?: string; message?: string; status?: string | number }): { code: string; message: string } {
  const raw = error?.message || "";
  const code = String(error?.status || "AUTH_ERROR");
  const lowered = raw.toLowerCase();
  if (String(error?.code || "").toLowerCase() === "email_not_confirmed") return { code: "EMAIL_NOT_CONFIRMED", message: "Confirm your email address using the link we sent before signing in." };
  if (lowered.includes("invalid login credentials")) return { code: "INVALID_CREDENTIALS", message: "Incorrect email or password." };
  if (lowered.includes("email not confirmed")) return { code: "EMAIL_NOT_CONFIRMED", message: "Confirm your email address using the link we sent before signing in." };
  if (lowered.includes("already registered")) return { code: "EMAIL_TAKEN", message: "An account already exists for this email. Sign in instead." };
  if (lowered.includes("password should be at least")) return { code: "WEAK_PASSWORD", message: raw };
  if (lowered.includes("rate limit")) return { code: "RATE_LIMITED", message: "Too many attempts. Wait a moment and try again." };
  return { code, message: "Authentication failed. Try again." };
}

export type AuthErrorPayload = ReturnType<typeof mapAuthError>;
export { mapAuthError };

export function userFromSessionForTests(session: Session): LiveUser {
  return identityFromSession(session);
}
