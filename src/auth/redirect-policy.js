export const SAFE_ROUTES = Object.freeze(["#/", "#/student", "#/tutor", "#/admin", "#/auth/update-password"]);
export function sanitizeInternalRoute(value, fallback = "#/") {
  if (typeof value !== "string") return fallback;
  let decoded;
  try { decoded = decodeURIComponent(value); } catch { return fallback; }
  if (/^(?:[a-z]+:|\/\/|\\|\/)/i.test(decoded)) return fallback;
  if (SAFE_ROUTES.includes(decoded)) return decoded;
  if (/^#\/(student|tutor)(?:\/[a-z0-9-]+)*$/i.test(decoded)) return decoded;
  return fallback;
}
export function callbackCode(locationObject, expectedCallbackUrl) {
  if (expectedCallbackUrl && `${locationObject.origin}${locationObject.pathname}` !== expectedCallbackUrl) throw new Error("INVALID_CALLBACK");
  if (locationObject.pathname !== "/auth/callback") throw new Error("INVALID_CALLBACK");
  const params = new URLSearchParams(locationObject.search);
  const codes = params.getAll("code");
  if (codes.length !== 1 || !/^[A-Za-z0-9._~-]{8,2048}$/.test(codes[0])) throw new Error("INVALID_CALLBACK");
  return codes[0];
}
export function routeForRole(role) {
  if (role === "student") return "#/student";
  if (role === "tutor") return "#/tutor";
  if (role === "admin") return "#/admin";
  return "#/";
}
