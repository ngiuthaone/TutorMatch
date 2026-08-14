import { getApiBaseUrl, getRuntimeConfig } from "./config";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ROLES = new Set(["student", "tutor", "admin"]);

export class ApiClientError extends Error {
  code: string;
  status: number;
  constructor(code: string, status = 0) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

export interface MeProfile {
  id: string;
  email: string | null;
  role: "student" | "tutor" | "admin";
  name: string;
  phone: string | null;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

function profileFrom(payload: unknown): MeProfile {
  const user = (payload as { ok?: boolean; user?: MeProfile } | null)?.ok === true ? (payload as { user: MeProfile }).user : null;
  if (!user || !UUID.test(user.id) || !ROLES.has(user.role) || typeof user.name !== "string") {
    throw new ApiClientError("INVALID_PROFILE", 500);
  }
  if (![user.createdAt, user.updatedAt].every((value) => typeof value === "string" && !Number.isNaN(Date.parse(value)))) {
    throw new ApiClientError("INVALID_PROFILE", 500);
  }
  return Object.freeze({
    id: user.id,
    email: typeof user.email === "string" ? user.email : null,
    role: user.role as MeProfile["role"],
    name: user.name,
    phone: typeof user.phone === "string" ? user.phone : null,
    avatarUrl: typeof user.avatarUrl === "string" ? user.avatarUrl : null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  });
}

export function createApiClient({ apiBaseUrl, fetchImpl = fetch, timeoutMs = 12_000 }: { apiBaseUrl: string; fetchImpl?: typeof fetch; timeoutMs?: number }) {
  const url = `${apiBaseUrl.replace(/\/$/, "")}/api/v1/me`;
  return Object.freeze({
    async getMe(accessToken: string): Promise<MeProfile> {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(url, {
          method: "GET",
          headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
          cache: "no-store",
          credentials: "omit",
          signal: controller.signal,
        });
        let body: unknown = null;
        try {
          body = await response.json();
        } catch {
          throw new ApiClientError("INVALID_RESPONSE", response.status);
        }
        if (!response.ok) {
          const byStatus: Record<number, string> = {
            401: "UNAUTHORIZED",
            403: "FORBIDDEN",
            404: "PROFILE_NOT_FOUND",
            429: "RATE_LIMITED",
            503: "SERVICE_UNAVAILABLE",
          };
          throw new ApiClientError(byStatus[response.status] || "INTERNAL_ERROR", response.status);
        }
        return profileFrom(body);
      } catch (error) {
        if (error instanceof ApiClientError) throw error;
        throw new ApiClientError(error instanceof Error && error.name === "AbortError" ? "TIMEOUT" : "NETWORK_ERROR");
      } finally {
        clearTimeout(timer);
      }
    },
  });
}

let runtimeClient: ReturnType<typeof createApiClient> | null = null;

export function getApiClient() {
  if (!runtimeClient) runtimeClient = createApiClient({ apiBaseUrl: getApiBaseUrl(getRuntimeConfig()) });
  return runtimeClient;
}
