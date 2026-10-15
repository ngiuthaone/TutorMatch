"use client";

import { getApiBaseUrl, isLiveMode as isConfigLiveMode } from "./auth/config";
import { getSessionAccessToken } from "./auth/session";

export class TutorDashboardApiError extends Error {
  code: string;
  status: number;
  constructor(code: string, status = 0, message?: string) {
    super(message || code);
    this.name = "TutorDashboardApiError";
    this.code = code;
    this.status = status;
  }
}

export interface TutorDashboardRating {
  count: number;
  average: number | null;
}

export interface TutorDashboardSummary {
  tutorProfile: {
    id: string;
    displayName: string;
    headline: string | null;
    publicationStatus: string;
    verificationStatus: string;
    hourlyRateVnd: number | null;
    avatarObjectPath: string | null;
  };
  todayCount: number;
  upcomingCount: number;
  monthEarningsVnd: number;
  monthCompletedCount: number;
  rating: TutorDashboardRating;
  pendingBookingsCount: number;
}

export interface TutorDashboardResult {
  isTutor: boolean;
  dashboard: TutorDashboardSummary | null;
}

export interface HomePageData {
  metrics: Array<{ label: string; value: string; hint?: string; trend?: { value: string; positive: boolean } }>;
  promotionBanner: { image: string; title: string; subtitle: string; cta: string; link: string };
  chartLabels: string[];
  chartValues: number[];
  upcomingCount: number;
  upcomingSessions: Array<{ id: string; learnerName: string; date: string; time: string; topic: string; href: string }>;
  sessionHealthScore: number;
  sessionHealthIssues: string[];
  notifications: Array<{ id: string; title: string; time: string }>;
}

export interface BookingsPageData {
  stats: { requests: number; awaiting: number; upcoming: number; past: number };
  bookings: Array<{ id: string; learnerName: string; date: string; time: string; topic: string; status: "requested" | "confirmed" | "completed" | "cancelled" | "no_show"; href: string }>;
}

export interface ListingsPageData {
  stats: { total: number; active: number; pending: number };
  listings: Array<{ id: string; title: string; price: string; rating: number; reviews: number; learners: number; status: "active" | "pending" | "paused"; href: string }>;
}

export interface CalendarPageData {
  cells: Array<{ date: string; sessions: Array<{ title: string; learnerName: string; status: string; href: string }> }>;
}

export interface LearnersPageData {
  stats: { active: number; newThisMonth: number; avgRating: number; retention: number };
  learners: Array<{ id: string; name: string; status: "active" | "new" | "inactive"; sessions: number; lastActive: string; rating: number; href: string }>;
}

export interface MarketingPageData {
  promotions: Array<{ id: string; name: string; description: string; startDate: string; endDate: string; audience: string; performance: { impressions: number; clicks: number; ctr: number }; href: string }>;
  campaigns: Array<{ id: string; name: string; description: string; targetAudience: string; startDate: string; endDate: string; performance: { impressions: number; clicks: number; ctr: number }; href: string }>;
  promoCodes: Array<{ id: string; code: string; uses: number; revenue: number; status: "active" | "expired"; href: string }>;
  opportunities: Array<{ id: string; name: string; description: string; targetAudience: string; startDate: string; endDate: string; status: "active" | "draft" | "expired"; href: string }>;
}

async function request<T>(path: string, init?: RequestInit & { authenticated?: boolean }): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (init?.body && !headers["Content-Type"]) headers["Content-Type"] = "application/json";
  if (init?.authenticated) {
    const token = getSessionAccessToken();
    if (!token) throw new TutorDashboardApiError("UNAUTHORIZED", 401, "Sign in required.");
    headers.Authorization = `Bearer ${token}`;
  }
  const response = await fetch(`${getApiBaseUrl().replace(/\/$/, "")}${path}`, {
    ...init,
    headers: { ...headers, ...(init?.headers ?? {}) },
    credentials: "omit",
    cache: "no-store",
  });
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    throw new TutorDashboardApiError("INVALID_RESPONSE", response.status);
  }
  if (!response.ok) {
    const code = typeof (payload as { error?: { code?: string } } | null)?.error?.code === "string"
      ? (payload as { error: { code: string } }).error.code
      : "INTERNAL_ERROR";
    throw new TutorDashboardApiError(code, response.status);
  }
  if ((payload as { ok?: unknown } | null)?.ok !== true) {
    throw new TutorDashboardApiError("INVALID_RESPONSE", response.status);
  }
  return payload as T;
}

export async function getMyTutorDashboard(): Promise<TutorDashboardResult> {
  if (!isLiveMode()) {
    return { isTutor: true, dashboard: MOCK_DASHBOARD_SUMMARY };
  }
  return request<TutorDashboardResult>("/api/v1/me/tutor-dashboard", { authenticated: true });
}

export async function submitTutorReview(input: { bookingId: string; rating: number; body: string }): Promise<unknown> {
  return request("/api/v1/me/tutor-reviews", {
    method: "POST",
    authenticated: true,
    body: JSON.stringify(input),
  });
}

export async function getTutorDashboardHome(): Promise<HomePageData> {
  if (!isLiveMode()) {
    return MOCK_HOME_PAGE;
  }
  return request<HomePageData>("/api/v1/me/tutor-dashboard/home", { authenticated: true });
}

export async function getTutorDashboardBookings(): Promise<BookingsPageData> {
  if (!isLiveMode()) {
    return MOCK_BOOKINGS_PAGE;
  }
  return request<BookingsPageData>("/api/v1/me/tutor-dashboard/bookings", { authenticated: true });
}

export async function getTutorDashboardListings(): Promise<ListingsPageData> {
  if (!isLiveMode()) {
    return MOCK_LISTINGS_PAGE;
  }
  return request<ListingsPageData>("/api/v1/me/tutor-dashboard/listings", { authenticated: true });
}

export async function getTutorDashboardCalendar(): Promise<CalendarPageData> {
  if (!isLiveMode()) {
    return MOCK_CALENDAR_PAGE;
  }
  return request<CalendarPageData>("/api/v1/me/tutor-dashboard/calendar", { authenticated: true });
}

export async function getTutorDashboardLearners(): Promise<LearnersPageData> {
  if (!isLiveMode()) {
    return MOCK_LEARNERS_PAGE;
  }
  return request<LearnersPageData>("/api/v1/me/tutor-dashboard/learners", { authenticated: true });
}

export async function getTutorDashboardMarketing(): Promise<MarketingPageData> {
  if (!isLiveMode()) {
    return MOCK_MARKETING_PAGE;
  }
  return request<MarketingPageData>("/api/v1/me/tutor-dashboard/marketing", { authenticated: true });
}

function isLiveMode(): boolean {
  try {
    return isConfigLiveMode();
  } catch {
    return false;
  }
}

export const MOCK_DASHBOARD_SUMMARY: TutorDashboardSummary = {
  tutorProfile: {
    id: "tutor-1",
    displayName: "Demo Tutor",
    headline: "English Teacher | IELTS & TOEIC Expert",
    publicationStatus: "published",
    verificationStatus: "verified",
    hourlyRateVnd: 350000,
    avatarObjectPath: null,
  },
  todayCount: 2,
  upcomingCount: 5,
  monthEarningsVnd: 41820000,
  monthCompletedCount: 24,
  rating: { count: 42, average: 4.9 },
  pendingBookingsCount: 3,
};

// ── Mock data ──────────────────────────────────────────────────────────────

const MOCK_HOME_PAGE: HomePageData = {
  metrics: [
    { label: "Completed this month", value: "24", hint: "+3 vs last month", trend: { value: "+14%", positive: true } },
    { label: "Revenue this month", value: "41,820,000₫", hint: "+12% vs last month", trend: { value: "+12%", positive: true } },
    { label: "Active listings", value: "8", hint: "All published" },
    { label: "Active learners", value: "52", hint: "+5 this month" },
  ],
  promotionBanner: {
    image: "",
    title: "Summer Intensive Workshop",
    subtitle: "Promote your summer intensive to 12,000+ learners this month.",
    cta: "Edit promotion",
    link: "/marketing",
  },
  chartLabels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  chartValues: [320, 410, 280, 520, 460, 380, 290],
  upcomingCount: 5,
  upcomingSessions: [
    { id: "s1", learnerName: "Lan Nguyen", date: "Jun 21", time: "09:00", topic: "IELTS Speaking Part 2", href: "/bookings/s1" },
    { id: "s2", learnerName: "Minh Tran", date: "Jun 21", time: "14:00", topic: "TOEIC Writing", href: "/bookings/s2" },
    { id: "s3", learnerName: "Ha Pham", date: "Jun 22", time: "10:00", topic: "Conversational English", href: "/bookings/s3" },
    { id: "s4", learnerName: "Duc Vo", date: "Jun 23", time: "16:00", topic: "Business English", href: "/bookings/s4" },
    { id: "s5", learnerName: "Linh Bui", date: "Jun 24", time: "08:00", topic: "IELTS Listening", href: "/bookings/s5" },
  ],
  sessionHealthScore: 94,
  sessionHealthIssues: ["2 sessions need reschedule", "1 no-show unresolved"],
  notifications: [
    { id: "n1", title: "New booking request from Lan Nguyen", time: "12 min ago" },
    { id: "n2", title: "Workshop starting in 30 minutes", time: "45 min ago" },
    { id: "n3", title: "Review from Minh Tran", time: "2 hours ago" },
  ],
};

const MOCK_BOOKINGS_PAGE: BookingsPageData = {
  stats: { requests: 3, awaiting: 2, upcoming: 5, past: 18 },
  bookings: [
    { id: "b1", learnerName: "Lan Nguyen", date: "Jun 21", time: "09:00", topic: "IELTS Speaking Part 2", status: "requested" as const, href: "/bookings/b1" },
    { id: "b2", learnerName: "Minh Tran", date: "Jun 21", time: "14:00", topic: "TOEIC Writing", status: "confirmed" as const, href: "/bookings/b2" },
    { id: "b3", learnerName: "Ha Pham", date: "Jun 22", time: "10:00", topic: "Conversational English", status: "confirmed" as const, href: "/bookings/b3" },
    { id: "b4", learnerName: "Duc Vo", date: "Jun 14", time: "16:00", topic: "Business English", status: "completed" as const, href: "/bookings/b4" },
    { id: "b5", learnerName: "Linh Bui", date: "Jun 10", time: "08:00", topic: "IELTS Listening", status: "cancelled" as const, href: "/bookings/b5" },
    { id: "b6", learnerName: "Khanh Le", date: "Jun 08", time: "11:00", topic: "Pronunciation", status: "no_show" as const, href: "/bookings/b6" },
  ],
};

const MOCK_LISTINGS_PAGE: ListingsPageData = {
  stats: { total: 8, active: 6, pending: 2 },
  listings: [
    { id: "l1", title: "IELTS Speaking Intensive", price: "350,000₫/hr", rating: 4.9, reviews: 34, learners: 18, status: "active" as const, href: "/listings/l1" },
    { id: "l2", title: "TOEIC Writing Bootcamp", price: "400,000₫/hr", rating: 4.8, reviews: 27, learners: 14, status: "active" as const, href: "/listings/l2" },
    { id: "l3", title: "Conversational English", price: "300,000₫/hr", rating: 4.7, reviews: 22, learners: 12, status: "active" as const, href: "/listings/l3" },
    { id: "l4", title: "Business English Pro", price: "450,000₫/hr", rating: 4.9, reviews: 19, learners: 9, status: "active" as const, href: "/listings/l4" },
    { id: "l5", title: "IELTS Listening Mastery", price: "320,000₫/hr", rating: 4.6, reviews: 15, learners: 8, status: "pending" as const, href: "/listings/l5" },
    { id: "l6", title: "Pronunciation Workshop", price: "280,000₫/hr", rating: 4.5, reviews: 11, learners: 6, status: "pending" as const, href: "/listings/l6" },
  ],
};

const MOCK_CALENDAR_PAGE: CalendarPageData = {
  cells: [
    { date: "21", sessions: [
      { title: "IELTS Speaking", learnerName: "Lan Nguyen", status: "confirmed", href: "/bookings/b1" },
      { title: "TOEIC Writing", learnerName: "Minh Tran", status: "confirmed", href: "/bookings/b2" },
    ]},
    { date: "22", sessions: [
      { title: "Conversational English", learnerName: "Ha Pham", status: "confirmed", href: "/bookings/b3" },
    ]},
    { date: "23", sessions: [] },
    { date: "24", sessions: [
      { title: "IELTS Listening", learnerName: "Linh Bui", status: "requested", href: "/bookings/b5" },
    ]},
    { date: "25", sessions: [] },
    { date: "26", sessions: [] },
    { date: "27", sessions: [] },
  ],
};

const MOCK_LEARNERS_PAGE: LearnersPageData = {
  stats: { active: 52, newThisMonth: 5, avgRating: 4.8, retention: 91 },
  learners: [
    { id: "lr1", name: "Lan Nguyen", status: "active" as const, sessions: 12, lastActive: "Jun 20", rating: 4.9, href: "/learners/lr1" },
    { id: "lr2", name: "Minh Tran", status: "active" as const, sessions: 8, lastActive: "Jun 19", rating: 4.8, href: "/learners/lr2" },
    { id: "lr3", name: "Ha Pham", status: "active" as const, sessions: 6, lastActive: "Jun 18", rating: 4.7, href: "/learners/lr3" },
    { id: "lr4", name: "Duc Vo", status: "active" as const, sessions: 5, lastActive: "Jun 15", rating: 4.9, href: "/learners/lr4" },
    { id: "lr5", name: "Linh Bui", status: "new" as const, sessions: 2, lastActive: "Jun 21", rating: 0, href: "/learners/lr5" },
    { id: "lr6", name: "Khanh Le", status: "inactive" as const, sessions: 3, lastActive: "May 28", rating: 4.5, href: "/learners/lr6" },
  ],
};

const MOCK_MARKETING_PAGE: MarketingPageData = {
  opportunities: [
    { id: "o1", name: "Summer IELTS Intensive", description: "20% discount for summer enrollment", targetAudience: "IELTS aspirants", startDate: "Jun 21", endDate: "Aug 31", status: "active", href: "/marketing/o1" },
    { id: "o2", name: "TOEIC Exam Prep Bundle", description: "Bundle discount for writing + listening", targetAudience: "TOEIC candidates", startDate: "Jul 01", endDate: "Jul 31", status: "draft", href: "/marketing/o2" },
  ],
  promotions: [
    { id: "p1", name: "Summer Intensive Workshop", description: "Promote summer intensive workshop", startDate: "Jun 21", endDate: "Aug 31", audience: "All learners", performance: { impressions: 12400, clicks: 890, ctr: 7.2 }, href: "/marketing/p1" },
    { id: "p2", name: "Back-to-School Special", description: "Discount for September enrollments", startDate: "Aug 15", endDate: "Sep 15", audience: "Returning learners", performance: { impressions: 8200, clicks: 510, ctr: 6.2 }, href: "/marketing/p2" },
  ],
  campaigns: [
    { id: "c1", name: "Social Media Awareness", description: "Facebook and Instagram ad campaign", targetAudience: "18-35 Ho Chi Minh City", startDate: "Jun 01", endDate: "Jun 30", performance: { impressions: 45000, clicks: 2100, ctr: 4.7 }, href: "/marketing/c1" },
    { id: "c2", name: "Email Nurture Series", description: "3-part email series for prospects", targetAudience: "Waitlisted learners", startDate: "Jul 01", endDate: "Jul 31", performance: { impressions: 3800, clicks: 340, ctr: 8.9 }, href: "/marketing/c2" },
  ],
  promoCodes: [
    { id: "pc1", code: "SUMMER20", uses: 156, revenue: 12500000, status: "active" as const, href: "/marketing/promo/summer20" },
    { id: "pc2", code: "TOEIC50", uses: 89, revenue: 4200000, status: "active" as const, href: "/marketing/promo/toeic50" },
    { id: "pc3", code: "OLDYEAR", uses: 203, revenue: 5800000, status: "expired" as const, href: "/marketing/promo/oldyear" },
  ],
};
