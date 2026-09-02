"use client";

import { getApiBaseUrl } from "./auth/config";
import { getSessionAccessToken } from "./auth/session";

export class HostCenterApiError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status = 0, message = code) {
    super(message);
    this.name = "HostCenterApiError";
    this.code = code;
    this.status = status;
  }
}

type ApiPayload = { error?: { code?: unknown; message?: unknown } };

function readApiError(response: Response, payload: unknown): HostCenterApiError {
  const error = payload as ApiPayload | null;
  return new HostCenterApiError(
    typeof error?.error?.code === "string" ? error.error.code : "HOST_CENTER_UNAVAILABLE",
    response.status,
    typeof error?.error?.message === "string" ? error.error.message : "Host Center is temporarily unavailable.",
  );
}

async function parseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new HostCenterApiError("INVALID_RESPONSE", response.status);
  }
}

async function get<T>(path: string): Promise<T> {
  const token = getSessionAccessToken();
  if (!token) throw new HostCenterApiError("UNAUTHORIZED", 401, "Sign in required.");
  const response = await fetch(`${getApiBaseUrl().replace(/\/$/, "")}${path}`, {
    headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    credentials: "omit",
    cache: "no-store",
  });
  const payload = await parseJson(response);
  if (!response.ok) throw readApiError(response, payload);
  if ((payload as { ok?: unknown } | null)?.ok !== true) throw new HostCenterApiError("INVALID_RESPONSE", response.status);
  return payload as T;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const token = getSessionAccessToken();
  if (!token) throw new HostCenterApiError("UNAUTHORIZED", 401, "Sign in required.");
  const response = await fetch(`${getApiBaseUrl().replace(/\/$/, "")}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${token}` },
    credentials: "omit",
    cache: "no-store",
    body: JSON.stringify(body),
  });
  const payload = await parseJson(response);
  if (!response.ok) throw readApiError(response, payload);
  if ((payload as { ok?: unknown } | null)?.ok !== true) throw new HostCenterApiError("INVALID_RESPONSE", response.status);
  return payload as T;
}

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
  nextPayoutAmount: number;
  nextPayoutDate: string | null;
  lastPayoutAmount: number;
  lastPayoutDate: string | null;
  recentPayouts: { id: string; amount: number; status: string; date: string }[];
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
  sessionTitle: string;
  learnerName: string;
  action: "issued" | "redeemed" | "undone";
  createdAt: string;
}

export interface CheckInToken {
  token: string;
  sessionId: string;
  issuedAt: string;
}

export interface CheckInRedeemResult {
  success: boolean;
  token: string;
  learnerName?: string;
  message?: string;
}

export interface CheckInUndoResult {
  success: boolean;
  token: string;
  message?: string;
}

export async function getHostDashboard(): Promise<{ dashboard: HostDashboardSummary }> {
  return get<{ dashboard: HostDashboardSummary }>("/api/v1/host/dashboard");
}

export async function listHostOfferings(params?: {
  status?: string;
  kind?: string;
  limit?: number;
  offset?: number;
}): Promise<{ offerings: HostOfferingSummary[] }> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);
  if (params?.kind) qs.set("kind", params.kind);
  if (params?.limit != null) qs.set("limit", String(params.limit));
  if (params?.offset != null) qs.set("offset", String(params.offset));
  const query = qs.toString();
  return get<{ offerings: HostOfferingSummary[] }>(`/api/v1/host/offerings${query ? `?${query}` : ""}`);
}

export async function getHostOffering(id: string): Promise<{ offering: HostOfferingDetail }> {
  return get<{ offering: HostOfferingDetail }>(`/api/v1/host/offerings/${id}`);
}

export async function listHostSessions(params?: {
  from?: string;
  to?: string;
  offeringId?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{ sessions: HostSessionRow[] }> {
  const qs = new URLSearchParams();
  if (params?.from) qs.set("from", params.from);
  if (params?.to) qs.set("to", params.to);
  if (params?.offeringId) qs.set("offeringId", params.offeringId);
  if (params?.status) qs.set("status", params.status);
  if (params?.limit != null) qs.set("limit", String(params.limit));
  if (params?.offset != null) qs.set("offset", String(params.offset));
  const query = qs.toString();
  return get<{ sessions: HostSessionRow[] }>(`/api/v1/host/sessions${query ? `?${query}` : ""}`);
}

export async function listHostAttendees(params?: {
  q?: string;
  offeringId?: string;
  limit?: number;
  offset?: number;
}): Promise<{ attendees: HostAttendeeRow[] }> {
  const qs = new URLSearchParams();
  if (params?.q) qs.set("q", params.q);
  if (params?.offeringId) qs.set("offeringId", params.offeringId);
  if (params?.limit != null) qs.set("limit", String(params.limit));
  if (params?.offset != null) qs.set("offset", String(params.offset));
  const query = qs.toString();
  return get<{ attendees: HostAttendeeRow[] }>(`/api/v1/host/attendees${query ? `?${query}` : ""}`);
}

export async function getHostEarnings(params?: { from?: string; to?: string }): Promise<{ earnings: HostEarnings }> {
  const qs = new URLSearchParams();
  if (params?.from) qs.set("from", params.from);
  if (params?.to) qs.set("to", params.to);
  const query = qs.toString();
  return get<{ earnings: HostEarnings }>(`/api/v1/host/earnings${query ? `?${query}` : ""}`);
}

export async function getHostAnalytics(): Promise<{ analytics: HostAnalytics }> {
  return get<{ analytics: HostAnalytics }>("/api/v1/host/analytics");
}

export async function getHostPayoutSummary(): Promise<HostPayoutSummary> {
  return get<HostPayoutSummary>("/api/v1/host/payout-summary");
}

export async function listHostTeam(params?: {
  offeringId?: string;
  limit?: number;
  offset?: number;
}): Promise<{ team: HostTeamMemberRow[] }> {
  const qs = new URLSearchParams();
  if (params?.offeringId) qs.set("offeringId", params.offeringId);
  if (params?.limit != null) qs.set("limit", String(params.limit));
  if (params?.offset != null) qs.set("offset", String(params.offset));
  const query = qs.toString();
  return get<{ team: HostTeamMemberRow[] }>(`/api/v1/host/team${query ? `?${query}` : ""}`);
}

export async function listHostPromotionCodes(params?: {
  offeringId?: string;
  limit?: number;
  offset?: number;
}): Promise<{ promotionCodes: HostPromotionCodeRow[] }> {
  const qs = new URLSearchParams();
  if (params?.offeringId) qs.set("offeringId", params.offeringId);
  if (params?.limit != null) qs.set("limit", String(params.limit));
  if (params?.offset != null) qs.set("offset", String(params.offset));
  const query = qs.toString();
  return get<{ promotionCodes: HostPromotionCodeRow[] }>(`/api/v1/host/promotion-codes${query ? `?${query}` : ""}`);
}

export async function issueCheckInToken(sessionId: string): Promise<CheckInToken> {
  return post<CheckInToken>("/api/v1/host/check-in/issue", { sessionId });
}

export async function redeemCheckInToken(token: string): Promise<{ result: CheckInRedeemResult }> {
  return post<{ result: CheckInRedeemResult }>("/api/v1/host/check-in/redeem", { token });
}

export async function undoCheckIn(token: string): Promise<{ result: CheckInUndoResult }> {
  return post<{ result: CheckInUndoResult }>("/api/v1/host/check-in/undo", { token });
}

export async function listHostCheckInLogs(params?: {
  sessionId?: string;
  limit?: number;
  offset?: number;
}): Promise<{ logs: HostCheckInLogRow[] }> {
  const qs = new URLSearchParams();
  if (params?.sessionId) qs.set("sessionId", params.sessionId);
  if (params?.limit != null) qs.set("limit", String(params.limit));
  if (params?.offset != null) qs.set("offset", String(params.offset));
  const query = qs.toString();
  return get<{ logs: HostCheckInLogRow[] }>(`/api/v1/host/check-in/logs${query ? `?${query}` : ""}`);
}

export async function listHostPayoutFailures(params?: {
  limit?: number;
  offset?: number;
}): Promise<{ failures: HostPayoutFailureRow[]; hasMore: boolean }> {
  const qs = new URLSearchParams();
  if (params?.limit != null) qs.set("limit", String(params.limit));
  if (params?.offset != null) qs.set("offset", String(params.offset));
  const query = qs.toString();
  return get<{ failures: HostPayoutFailureRow[]; hasMore: boolean }>(`/api/v1/host/payout-failures${query ? `?${query}` : ""}`);
}

export async function retryPayoutFailure(failureId: string): Promise<{ id: string; status: string; attemptCount?: number }> {
  return post<{ id: string; status: string; attemptCount?: number }>(`/api/v1/host/payout-failures/${failureId}/retry`, {});
}

export interface HostPayoutStatementRow {
  period: string;
  grossVnd: number;
  refundsVnd: number;
  commissionVnd: number;
  netVnd: number;
}

export async function listHostPayoutStatements(params?: {
  limit?: number;
  offset?: number;
}): Promise<{ statements: HostPayoutStatementRow[]; hasMore: boolean }> {
  const qs = new URLSearchParams();
  if (params?.limit != null) qs.set("limit", String(params.limit));
  if (params?.offset != null) qs.set("offset", String(params.offset));
  const query = qs.toString();
  return get<{ statements: HostPayoutStatementRow[]; hasMore: boolean }>(`/api/v1/host/payout-statements${query ? `?${query}` : ""}`);
}

export function buildAttendeesCsvUrl(params?: { q?: string; offeringId?: string; from?: string; to?: string }): string {
  const qs = new URLSearchParams();
  if (params?.q) qs.set("q", params.q);
  if (params?.offeringId) qs.set("offeringId", params.offeringId);
  if (params?.from) qs.set("from", params.from);
  if (params?.to) qs.set("to", params.to);
  const query = qs.toString();
  return `/api/v1/host/attendees/export${query ? `?${query}` : ""}`;
}

export function buildEarningsCsvUrl(params?: { from?: string; to?: string }): string {
  const qs = new URLSearchParams();
  if (params?.from) qs.set("from", params.from);
  if (params?.to) qs.set("to", params.to);
  const query = qs.toString();
  return `/api/v1/host/earnings/export${query ? `?${query}` : ""}`;
}
