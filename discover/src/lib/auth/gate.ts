import type { LiveSessionState } from "./session";

export type AuthGateAction =
  | { type: "authorize" }
  | { type: "wait" }
  | { type: "redirect"; to: string };

/**
 * Decides how a protected route should respond to the current session state.
 *
 * Session restoration is asynchronous, so "initializing" must wait rather than
 * redirect: an immediate redirect would cause sign-in flicker and redirect
 * loops on every page load. "unavailable" keeps the gate closed without
 * redirecting so no privileged UI is shown while auth is degraded.
 */
export function evaluateAuthGate(status: LiveSessionState["status"], pathname: string): AuthGateAction {
  switch (status) {
    case "authenticated":
      return { type: "authorize" };
    case "anonymous":
      return { type: "redirect", to: `/auth/sign-in?next=${encodeURIComponent(pathname)}` };
    case "initializing":
    case "unavailable":
      return { type: "wait" };
  }
}
