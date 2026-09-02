import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "../errors/api-error.js";
import { logServiceError } from "../lib/service-error.js";

export type HostOfferingKind = "tutor" | "workshop" | "class" | "event";
export type HostOfferingPublicationStatus = "draft" | "published" | "unpublished";
export type HostSessionStatus = "scheduled" | "cancelled" | "completed";
export type HostPaymentStatus = "pending" | "succeeded" | "failed" | "refunded";

export interface HostDashboardTutorProfile {
  id: string;
  displayName: string;
  headline: string | null;
  publicationStatus: string;
  verificationStatus: string;
  hourlyRateVnd: number | null;
  avatarObjectPath: string | null;
}

export interface HostDashboardRating {
  count: number;
  average: number | null;
}

export interface HostDashboardSummary {
  isHost: boolean;
  managedOfferingCount: number;
  tutorProfile: HostDashboardTutorProfile | null;
  todayCount: number;
  upcomingCount: number;
  pendingBookingsCount: number;
  monthCompletedCount: number;
  monthEarningsVnd: number;
  rating: HostDashboardRating;
}

export interface HostOfferingSummary {
  id: string;
  kind: HostOfferingKind;
  slug: string;
  title: string;
  publicationStatus: HostOfferingPublicationStatus;
  unitPriceVnd: number | null;
  currency: string;
  sessionCount: number;
  bookingCount: number;
  lastSessionAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HostOfferingDetail extends HostOfferingSummary {
  description: string | null;
  config: Record<string, unknown>;
  capability: "owner" | "host";
}

export interface HostSessionRow {
  id: string;
  offeringId: string;
  offeringTitle: string;
  offeringKind: HostOfferingKind;
  startsAt: string;
  endsAt: string;
  status: HostSessionStatus;
  minParticipants: number | null;
  maxParticipants: number | null;
  bookedCount: number;
  remainingCapacity: number;
  version: number;
}

export interface HostAttendeeRow {
  learnerId: string;
  displayName: string;
  avatarObjectPath: string | null;
  bookingsCount: number;
  completedCount: number;
  upcomingCount: number;
  ltvVnd: number;
  lastBookingAt: string | null;
}

export interface HostEarningsTransaction {
  paymentId: string;
  bookingId: string;
  status: HostPaymentStatus;
  amountVnd: number;
  refundedAmountVnd: number;
  currency: string;
  occurredAt: string;
  offeringTitle: string;
}

export interface HostEarningsTotals {
  grossVnd: number;
  refundedVnd: number;
  netVnd: number;
  hostFeeVnd: number;
  hostNetVnd: number;
  paidVnd: number;
  pendingVnd: number;
}

export interface HostEarnings {
  currency: string;
  from: string;
  to: string;
  totals: HostEarningsTotals;
  transactions: HostEarningsTransaction[];
}

function mapError(service: string, operation: string, error: { message?: string; code?: string }): never {
  const message = typeof error.message === "string" ? error.message : "";
  const code = typeof error.code === "string" ? error.code : "";
  if (code === "42501" || message.includes("FORBIDDEN") || message.includes("UNAUTHORIZED")) {
    throw new ApiError(403, "FORBIDDEN", "You don't have access to this host data.");
  }
  if (message.includes("NOT_FOUND")) {
    throw new ApiError(404, "NOT_FOUND", "Resource not found.");
  }
  if (message.includes("INVALID_STATUS") || message.includes("INVALID_KIND")) {
    throw new ApiError(400, "INVALID_INPUT", message);
  }
  logServiceError({ service, operation, error });
  throw new ApiError(503, "HOST_CENTER_UNAVAILABLE", "Tutoria Center is temporarily unavailable.");
}

export type HostCenterServiceResult<T> =
  | { status: "ok"; data: T }
  | { status: "unavailable" };

export interface HostCenterService {
  getDashboard(token: string, userId: string): Promise<HostCenterServiceResult<HostDashboardSummary>>;
  listOfferings(
    token: string,
    userId: string,
    params: { status?: string; kind?: string; limit?: number; offset?: number }
  ): Promise<HostCenterServiceResult<HostOfferingSummary[]>>;
  getOffering(token: string, userId: string, offeringId: string): Promise<HostCenterServiceResult<HostOfferingDetail>>;
  listSessions(
    token: string,
    userId: string,
    params: { from?: string; to?: string; offeringId?: string; status?: string; limit?: number; offset?: number }
  ): Promise<HostCenterServiceResult<HostSessionRow[]>>;
  listAttendees(
    token: string,
    userId: string,
    params: { query?: string; offeringId?: string; limit?: number; offset?: number }
  ): Promise<HostCenterServiceResult<HostAttendeeRow[]>>;
  getEarnings(token: string, userId: string, params: { from?: string; to?: string }): Promise<HostCenterServiceResult<HostEarnings>>;
}

export function defaultClientFactory(url: string, publishableKey: string): (token?: string) => SupabaseClient {
  return (token?: string) => createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    ...(token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {}),
  });
}

export function createSupabaseHostCenterService(
  url: string,
  publishableKey: string,
  clientFactory: (token?: string) => SupabaseClient = defaultClientFactory(url, publishableKey)
): HostCenterService {
  return {
    async getDashboard(token, userId) {
      const supabase = clientFactory(token);
      const { data, error } = await supabase.rpc("get_host_dashboard", { p_user_id: userId });
      if (error) mapError("host-center-service", "get_host_dashboard", error);
      return { status: "ok", data: data as HostDashboardSummary };
    },

    async listOfferings(token, userId, params) {
      const supabase = clientFactory(token);
      const { data, error } = await supabase.rpc("list_host_offerings", {
        p_user_id: userId,
        p_status: params.status ?? null,
        p_kind: params.kind ?? null,
        p_limit: params.limit ?? 100,
        p_offset: params.offset ?? 0,
      });
      if (error) mapError("host-center-service", "list_host_offerings", error);
      return { status: "ok", data: (data ?? []) as HostOfferingSummary[] };
    },

    async getOffering(token, userId, offeringId) {
      const supabase = clientFactory(token);
      const { data, error } = await supabase.rpc("get_host_offering", {
        p_user_id: userId,
        p_offering_id: offeringId,
      });
      if (error) mapError("host-center-service", "get_host_offering", error);
      return { status: "ok", data: data as HostOfferingDetail };
    },

    async listSessions(token, userId, params) {
      const supabase = clientFactory(token);
      const { data, error } = await supabase.rpc("list_host_sessions", {
        p_user_id: userId,
        p_from: params.from ?? null,
        p_to: params.to ?? null,
        p_offering_id: params.offeringId ?? null,
        p_status: params.status ?? null,
        p_limit: params.limit ?? 200,
        p_offset: params.offset ?? 0,
      });
      if (error) mapError("host-center-service", "list_host_sessions", error);
      return { status: "ok", data: (data ?? []) as HostSessionRow[] };
    },

    async listAttendees(token, userId, params) {
      const supabase = clientFactory(token);
      const { data, error } = await supabase.rpc("list_host_attendees", {
        p_user_id: userId,
        p_query: params.query ?? null,
        p_offering_id: params.offeringId ?? null,
        p_limit: params.limit ?? 100,
        p_offset: params.offset ?? 0,
      });
      if (error) mapError("host-center-service", "list_host_attendees", error);
      return { status: "ok", data: (data ?? []) as HostAttendeeRow[] };
    },

    async getEarnings(token, userId, params) {
      const supabase = clientFactory(token);
      const { data, error } = await supabase.rpc("get_host_earnings", {
        p_user_id: userId,
        p_from: params.from ?? null,
        p_to: params.to ?? null,
      });
      if (error) mapError("host-center-service", "get_host_earnings", error);
      return { status: "ok", data: data as HostEarnings };
    },
  };
}