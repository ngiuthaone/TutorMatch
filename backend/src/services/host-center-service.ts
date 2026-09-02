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

export interface HostAnalyticsDailyBucket {
  date: string;
  bookings: number;
  gross: number;
}

export interface HostAnalyticsWeeklyBucket {
  weekStart: string;
  bookings: number;
  gross: number;
}

export interface HostAnalyticsTopOffering {
  title: string;
  bookings: number;
  gross: number;
  growthPct: number;
}

export interface HostAnalytics {
  totalBookings: number;
  totalGross: number;
  avgBookingValue: number;
  bookingGrowth: number;
  revenueGrowth: number;
  capacityUtilization: number;
  totalCapacity: number;
  totalBooked: number;
  impressions: number;
  pageVisits: number;
  conversionRate: number;
  daily: HostAnalyticsDailyBucket[];
  weekly: HostAnalyticsWeeklyBucket[];
  topOfferings: HostAnalyticsTopOffering[];
}

export interface HostPayoutSummary {
  availableBalance: number;
  pendingBalance: number;
  nextPayoutAmount: number;
  nextPayoutDate: string | null;
  lastPayoutAmount: number;
  lastPayoutDate: string | null;
  recentPayouts: { id: string; amount: number; status: string; date: string }[];
}

export interface HostTeamMemberRow {
  id: string;
  name: string;
  email: string;
  role: string;
  joinedAt: string;
}

export interface HostPromotionCodeRow {
  id: string;
  code: string;
  discountType: "percent" | "fixed";
  discountValue: number;
  uses: number;
  maxUses: number | null;
  expiresAt: string | null;
  status: string;
}

export interface HostCheckInLogRow {
  id: string;
  token: string;
  action: string;
  sessionTitle: string;
  learnerName: string;
  createdAt: string;
}

export interface CheckInToken {
  token: string;
  sessionId: string;
  issuedAt: string;
}

export interface CheckInRedeemResult {
  success: boolean;
  alreadyRedeemed?: boolean;
  token?: string;
  sessionId?: string;
  checkedInAt?: string;
  logId?: string;
  message?: string;
}

export interface CheckInUndoResult {
  success: boolean;
  token?: string;
  logId?: string;
  message?: string;
}

export interface HostPayoutFailureRow {
  id: string;
  period: string;
  amountVnd: number;
  reason: string;
  attemptCount: number;
  maxAttempts: number;
  status: "pending" | "retrying" | "resolved" | "failed_permanently";
  lastAttemptAt: string | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
  createdAt: string;
}

export interface HostPayoutStatementRow {
  period: string;
  grossVnd: number;
  refundsVnd: number;
  commissionVnd: number;
  netVnd: number;
}

export interface HostPayoutStatementList {
  statements: HostPayoutStatementRow[];
  hasMore: boolean;
}

export interface HostPayoutFailureList {
  failures: HostPayoutFailureRow[];
  hasMore: boolean;
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
  getAnalytics(token: string, userId: string): Promise<HostCenterServiceResult<HostAnalytics>>;
  getPayoutSummary(token: string, userId: string): Promise<HostCenterServiceResult<HostPayoutSummary>>;
  listTeam(
    token: string,
    userId: string,
    params: { offeringId?: string; limit?: number; offset?: number }
  ): Promise<HostCenterServiceResult<HostTeamMemberRow[]>>;
  listPromotionCodes(
    token: string,
    userId: string,
    params: { offeringId?: string; limit?: number; offset?: number }
  ): Promise<HostCenterServiceResult<HostPromotionCodeRow[]>>;
  issueCheckInToken(token: string, userId: string, sessionId: string): Promise<HostCenterServiceResult<CheckInToken>>;
  redeemCheckInToken(token: string, userId: string, tokenCode: string): Promise<HostCenterServiceResult<CheckInRedeemResult>>;
  undoCheckIn(token: string, userId: string, tokenCode: string): Promise<HostCenterServiceResult<CheckInUndoResult>>;
  listCheckInLogs(
    token: string,
    userId: string,
    params: { sessionId?: string; limit?: number; offset?: number }
  ): Promise<HostCenterServiceResult<HostCheckInLogRow[]>>;
  listPayoutFailures(
    token: string,
    userId: string,
    params: { limit?: number; offset?: number }
  ): Promise<HostCenterServiceResult<HostPayoutFailureList>>;
  retryPayoutFailure(token: string, failureId: string): Promise<HostCenterServiceResult<{ id: string; status: string; attemptCount?: number }>>;
  listPayoutStatements(token: string, userId: string, params: { limit?: number; offset?: number }): Promise<HostCenterServiceResult<HostPayoutStatementList>>;
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

    async getAnalytics(token, userId) {
      const supabase = clientFactory(token);
      const { data, error } = await supabase.rpc("get_host_analytics", { p_user_id: userId });
      if (error) mapError("host-center-service", "get_host_analytics", error);
      return { status: "ok", data: data as HostAnalytics };
    },

    async getPayoutSummary(token, userId) {
      const supabase = clientFactory(token);
      const { data, error } = await supabase.rpc("get_host_payout_summary", { p_user_id: userId });
      if (error) mapError("host-center-service", "get_host_payout_summary", error);
      return { status: "ok", data: data as HostPayoutSummary };
    },

    async listTeam(token, userId, params) {
      const supabase = clientFactory(token);
      const { data, error } = await supabase.rpc("list_host_team", {
        p_user_id: userId,
        p_offering_id: params.offeringId ?? null,
        p_limit: params.limit ?? 100,
        p_offset: params.offset ?? 0,
      });
      if (error) mapError("host-center-service", "list_host_team", error);
      return { status: "ok", data: (data ?? []) as HostTeamMemberRow[] };
    },

    async listPromotionCodes(token, userId, params) {
      const supabase = clientFactory(token);
      const { data, error } = await supabase.rpc("list_host_promotion_codes", {
        p_user_id: userId,
        p_offering_id: params.offeringId ?? null,
        p_limit: params.limit ?? 100,
        p_offset: params.offset ?? 0,
      });
      if (error) mapError("host-center-service", "list_host_promotion_codes", error);
      return { status: "ok", data: (data ?? []) as HostPromotionCodeRow[] };
    },

    async issueCheckInToken(token, userId, sessionId) {
      const supabase = clientFactory(token);
      const { data, error } = await supabase.rpc("issue_check_in_token", {
        p_user_id: userId,
        p_session_id: sessionId,
      });
      if (error) mapError("host-center-service", "issue_check_in_token", error);
      return { status: "ok", data: data as CheckInToken };
    },

    async redeemCheckInToken(token, userId, tokenCode) {
      const supabase = clientFactory(token);
      const { data, error } = await supabase.rpc("redeem_check_in_token", {
        p_user_id: userId,
        p_token: tokenCode,
      });
      if (error) mapError("host-center-service", "redeem_check_in_token", error);
      return { status: "ok", data: data as CheckInRedeemResult };
    },

    async undoCheckIn(token, userId, tokenCode) {
      const supabase = clientFactory(token);
      const { data, error } = await supabase.rpc("undo_check_in", {
        p_user_id: userId,
        p_token: tokenCode,
      });
      if (error) mapError("host-center-service", "undo_check_in", error);
      return { status: "ok", data: data as CheckInUndoResult };
    },

    async listCheckInLogs(token, userId, params) {
      const supabase = clientFactory(token);
      const { data, error } = await supabase.rpc("list_host_check_in_logs", {
        p_user_id: userId,
        p_session_id: params.sessionId ?? null,
        p_limit: params.limit ?? 100,
        p_offset: params.offset ?? 0,
      });
      if (error) mapError("host-center-service", "list_host_check_in_logs", error);
      return { status: "ok", data: (data ?? []) as HostCheckInLogRow[] };
    },

    async listPayoutFailures(token, userId, params) {
      const supabase = clientFactory(token);
      const { data, error } = await supabase.rpc("list_host_payout_failures", {
        p_user_id: userId,
        p_limit: params.limit ?? 100,
        p_offset: params.offset ?? 0,
      });
      if (error) mapError("host-center-service", "list_host_payout_failures", error);
      return { status: "ok", data: data as HostPayoutFailureList };
    },

    async retryPayoutFailure(token, failureId) {
      const supabase = clientFactory(token);
      const { data, error } = await supabase.rpc("retry_payout_failure", {
        p_failure_id: failureId,
      });
      if (error) mapError("host-center-service", "retry_payout_failure", error);
      return { status: "ok", data: data as { id: string; status: string; attemptCount?: number } };
    },

    async listPayoutStatements(token, userId, params) {
      const supabase = clientFactory(token);
      const { data, error } = await supabase.rpc("list_host_payout_statements", {
        p_user_id: userId,
        p_limit: params.limit ?? 24,
        p_offset: params.offset ?? 0,
      });
      if (error) mapError("host-center-service", "list_host_payout_statements", error);
      return { status: "ok", data: data as HostPayoutStatementList };
    },
  };
}