import { routeForRole, sanitizeInternalRoute } from "./redirect-policy.js";
export function classifyRoute(hash) {
  const path = String(hash || "#/").split("?")[0];
  if (/^#\/auth\//.test(path) || path === "#/") return { access: "public" };
  if (/^#\/student(?:\/|$)/.test(path)) return { access: "role", role: "student" };
  if (/^#\/tutor(?:\/|$)/.test(path)) return { access: "role", role: "tutor" };
  if (/^#\/admin(?:\/|$)/.test(path)) return { access: "role", role: "admin" };
  if (/^#\/(case|messages|settings)(?:\/|$)/.test(path)) return { access: "authenticated" };
  return { access: "public" };
}
export function guardRoute(hash, authState) {
  const route = classifyRoute(hash);
  if (route.access === "public") return { allowed: true };
  if (authState.status === "initializing") return { allowed: false, reason: "initializing" };
  if (authState.status !== "authenticated") return { allowed: false, reason: "anonymous", redirect: "#/auth/sign-in", returnTo: sanitizeInternalRoute(hash) };
  if (route.role && authState.profile?.role !== route.role) return { allowed: false, reason: "forbidden", redirect: routeForRole(authState.profile?.role) };
  return { allowed: true };
}
